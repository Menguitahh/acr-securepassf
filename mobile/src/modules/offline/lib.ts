import type { components } from '@securepass/contracts';

import { BACKOFF_SCHEDULE_MS } from '@/modules/offline/data';
import type { OutboxEvent } from '@/modules/offline/types';

export function backoffDelayFor(attempts: number): number {
  const index = Math.min(Math.max(attempts, 0), BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[index] ?? BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1] ?? 300000;
}

// Un gateId sincronizable es un string no-vacio (garita configurada).
// null se acepta al hidratar (evento encolado antes de que el device
// tenga garita), pero no viaja al server hasta que el mismo device se
// configure.
//
// Fuente unica del predicado. Antes de este helper, tres puntos evaluaban
// gateId con expresiones distintas — `isOutboxEvent` aceptaba null OR
// cualquier string (incluso ''), el peek filter usaba `!== null` (deja
// pasar ''), y `toSyncEvent` usaba `!gateId` (elimina ''). Con
// EXPO_PUBLIC_GATE_ID= en .env, un evento con `gateId=''` pasaba el
// peek, se filtraba dentro del send, y `runSyncCycle` borraba el
// clientEventId al final igual porque send no throwo. Perdida silenciosa.
export function hasValidGate(gateId: unknown): gateId is string {
  return typeof gateId === 'string' && gateId.length > 0;
}

// Clasifica filas del outbox como huerfanas para el prune del bootstrap
// (#83). Es pura (no toca DB) para que el test blinde la regla mas
// critica: una fila con gateId real NUNCA se marca para borrar, sin
// importar edad ni forma del payload. La ejecucion del DELETE vive en
// pruneOrphanOutboxEvents (outbox.ts), que solo aplica los ids que
// esta funcion devuelve.
//
// Categorias:
// - gateId === '': se borra siempre. Misconfig historica de
//   EXPO_PUBLIC_GATE_ID vacio (pre #82). Nunca es sincronizable.
// - gateId === null: se borra si created_at < now - maxAgeMs. Un evento
//   reciente sin garita puede volverse sincronizable si administracion
//   configura el device. Uno viejo, no.
// - gateId string no-vacio: NO se toca nunca. Fila valida = ingreso
//   pendiente de sincronizar, no basura, aunque tenga 6 meses.
// - payload no parseable o gateId de tipo raro: se trata como null
//   (borra por edad). Corrupto es orphan; el umbral es la unica cautela.
export type OutboxOrphanRow = {
  clientEventId: string;
  payload: string;
  createdAt: string;
};

export type OrphanClassification = {
  removeEmpty: string[];
  removeStale: string[];
};

export function classifyOrphanOutboxRows(
  rows: readonly OutboxOrphanRow[],
  nowMs: number,
  maxAgeMsForNullGate: number,
): OrphanClassification {
  const removeEmpty: string[] = [];
  const removeStale: string[] = [];
  const cutoffMs = nowMs - maxAgeMsForNullGate;

  for (const row of rows) {
    const gateId = extractGateIdFromPayload(row.payload);
    if (gateId === '') {
      removeEmpty.push(row.clientEventId);
      continue;
    }
    if (typeof gateId === 'string' && gateId.length > 0) {
      // Fila valida. Nunca se toca — aunque tenga anios.
      continue;
    }
    // gateId null, ausente, o payload corrupto: se borra si es viejo.
    const createdMs = Date.parse(row.createdAt);
    if (Number.isFinite(createdMs) && createdMs < cutoffMs) {
      removeStale.push(row.clientEventId);
    }
  }

  return { removeEmpty, removeStale };
}

function extractGateIdFromPayload(payload: string): string | null | undefined {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed && typeof parsed === 'object' && 'gateId' in parsed) {
      const value = (parsed as { gateId: unknown }).gateId;
      if (value === null) return null;
      if (typeof value === 'string') return value;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function isOutboxEvent(value: unknown): value is OutboxEvent {
  if (typeof value !== 'object' || value === null) return false;
  if (!('clientEventId' in value) || typeof value.clientEventId !== 'string') return false;
  if (!('token' in value) || typeof value.token !== 'string') return false;
  if (!('gateId' in value) || (value.gateId !== null && !hasValidGate(value.gateId))) {
    return false;
  }
  if (!('direction' in value) || (value.direction !== 'IN' && value.direction !== 'OUT')) {
    return false;
  }
  if (!('companions' in value) || (typeof value.companions !== 'number' && value.companions !== null)) {
    return false;
  }
  if (!('capturedAt' in value) || typeof value.capturedAt !== 'string') return false;
  if (
    !('localDecision' in value) ||
    (value.localDecision !== 'ALLOWED' && value.localDecision !== 'DENIED')
  ) {
    return false;
  }
  if (
    !('documentNumber' in value) ||
    (value.documentNumber !== null && !hasNonEmptyString(value.documentNumber))
  ) {
    return false;
  }
  return true;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

// Resultado per-evento del sync (#27, PR composite). Reemplaza la
// asuncion pre-existente de "send resolve => todo el batch se acepto",
// que abria dos vectores de bug: perdida silenciosa cuando send filtraba
// eventos internamente (ver #82, cerrado), y poison pill cuando el server
// rechazaba uno del batch pero borrabamos todos (o ninguno).
//
// - remove: clientEventIds que salen del outbox: aceptados por el server
//   (result ALLOWED/ENROLLED) O rechazados terminales (DOCUMENT_MISMATCH,
//   REPLAY, EXPIRED, etc). El server dio veredicto, no reintentamos.
// - retry: clientEventIds cuyo attempts++ y se quedan en la cola.
//   Rechazos transitorios del server (si existen). La red caida se
//   maneja aparte (throw en send).
export type SendOutcome = {
  remove: string[];
  retry: string[];
};

export type SyncCycleDeps = {
  peek: (limit: number) => OutboxEvent[];
  send: (events: OutboxEvent[]) => Promise<SendOutcome>;
  remove: (clientEventIds: string[]) => void;
  markFailure: (clientEventIds: string[], reason: string) => void;
};

export type SyncCycleOutcome = 'empty' | 'synced' | 'error';

// Un ciclo de sync: toma un batch, lo envia y actua per-evento sobre la
// respuesta. La red caida (throw en send) marca todo el batch como fallo
// transitorio; la respuesta del server clasifica cada evento como
// remove o retry.
//
// Guard estructural: send solo puede reportar clientEventIds que le
// fueron pasados en el batch. Si aparece un id fuera del batch, throw —
// eso implica un bug en send (mapping equivocado, id inventado, o
// re-uso de un id de otro batch).
export async function runSyncCycle(
  deps: SyncCycleDeps,
  limit: number,
): Promise<SyncCycleOutcome> {
  const events = deps.peek(limit);
  if (events.length === 0) return 'empty';
  const batchIds = new Set(events.map((event) => event.clientEventId));

  let outcome: SendOutcome;
  try {
    outcome = await deps.send(events);
  } catch {
    // Red caida: attempts++ solo del batch, no de toda la cola.
    deps.markFailure(events.map((event) => event.clientEventId), 'red caida al intentar sync');
    return 'error';
  }

  const reported = [...outcome.remove, ...outcome.retry];
  for (const id of reported) {
    if (!batchIds.has(id)) {
      throw new Error(
        `send reporto clientEventId ${id} que no estaba en el batch. Bug en el mapping.`,
      );
    }
  }

  if (outcome.remove.length > 0) deps.remove(outcome.remove);
  if (outcome.retry.length > 0) deps.markFailure(outcome.retry, 'rechazo transitorio del server');
  return 'synced';
}

// Un evento sin garita no se puede sincronizar: se queda en la cola hasta
// que el dispositivo tenga garita configurada (EXPO_PUBLIC_GATE_ID).
// Guardia defensivo: el peek filter ya excluye estos eventos del batch;
// este check adicional garantiza que si alguien llama toSyncEvent directo
// con un evento sin garita, devuelva null y no un mapping mentiroso.
export function toSyncEvent(
  event: OutboxEvent,
): components['schemas']['Event'] | null {
  if (!hasValidGate(event.gateId)) return null;
  return {
    clientEventId: event.clientEventId,
    token: event.token,
    gateId: event.gateId,
    direction: event.direction,
    capturedAt: event.capturedAt,
    localDecision: event.localDecision,
    ...(event.companions !== null ? { companions: event.companions } : {}),
    // Invariante estructural (#27): un evento con documentNumber es un
    // enrolamiento diferido; el server lo procesa como enrolamiento +
    // ingreso. Sin este campo, el server registraria el ingreso sin
    // enrolamiento — cache local mentiroso, data corruption silenciosa.
    // Tests: "regresion: evento con documentNumber no viaja sin el DNI".
    ...(event.documentNumber !== null ? { documentNumber: event.documentNumber } : {}),
  };
}
