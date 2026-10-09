import type { components } from '@securepass/contracts';

import { BACKOFF_SCHEDULE_MS, LOCAL_DENIAL_REASONS } from '@/modules/offline/data';
import type {
  LocalDecision,
  LocalDenialReason,
  OutboxEvent,
  WorkerCacheSnapshot,
  WorkerPermissionRow,
} from '@/modules/offline/types';
import type { EnrollmentSubject } from '@/modules/scanner/types';

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
// gateId con expresiones distintas — el parser del outbox aceptaba null OR
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

function isLocalDenialReason(value: unknown): value is LocalDenialReason {
  return typeof value === 'string' && Object.keys(LOCAL_DENIAL_REASONS).includes(value);
}

// Lee una fila del outbox. Null si no tiene la forma de un evento.
// Las filas DENIED encoladas antes de que existiera localDenialReason no
// traen motivo: salen como UNKNOWN en vez de descartarse, porque el
// rechazo igual tiene que llegar al server.
export function parseOutboxEvent(value: unknown): OutboxEvent | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('clientEventId' in value) || typeof value.clientEventId !== 'string') return null;
  if (!('token' in value) || typeof value.token !== 'string') return null;
  if (!('gateId' in value) || (value.gateId !== null && !hasValidGate(value.gateId))) {
    return null;
  }
  if (!('direction' in value) || (value.direction !== 'IN' && value.direction !== 'OUT')) {
    return null;
  }
  if (!('companions' in value) || (typeof value.companions !== 'number' && value.companions !== null)) {
    return null;
  }
  if (!('capturedAt' in value) || typeof value.capturedAt !== 'string') return null;
  if (
    !('documentNumber' in value) ||
    (value.documentNumber !== null && !hasNonEmptyString(value.documentNumber))
  ) {
    return null;
  }
  if (!('localDecision' in value)) return null;
  let decision: LocalDecision;
  if (value.localDecision === 'ALLOWED') {
    decision = { localDecision: 'ALLOWED' };
  } else if (value.localDecision === 'DENIED') {
    const reason = 'localDenialReason' in value ? value.localDenialReason : undefined;
    decision = {
      localDecision: 'DENIED',
      localDenialReason: isLocalDenialReason(reason) ? reason : 'UNKNOWN',
    };
  } else {
    return null;
  }
  return {
    ...decision,
    clientEventId: value.clientEventId,
    token: value.token,
    gateId: value.gateId,
    direction: value.direction,
    companions: value.companions,
    capturedAt: value.capturedAt,
    documentNumber: value.documentNumber,
    // WBS-119: sin esto el lote elegido sin red no llegaba al sync.
    lotId: 'lotId' in value && hasNonEmptyString(value.lotId) ? value.lotId : null,
  };
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
    ...(event.localDecision === 'DENIED' ? { localDenialReason: event.localDenialReason } : {}),
    ...(event.companions !== null ? { companions: event.companions } : {}),
    // Invariante estructural (#27): un evento con documentNumber es un
    // enrolamiento diferido; el server lo procesa como enrolamiento +
    // ingreso. Sin este campo, el server registraria el ingreso sin
    // enrolamiento — cache local mentiroso, data corruption silenciosa.
    // Tests: "regresion: evento con documentNumber no viaja sin el DNI".
    ...(event.documentNumber !== null ? { documentNumber: event.documentNumber } : {}),
    // WBS-119: el sync evalua la franja de ese lote en capturedAt.
    ...(event.lotId ? { lotId: event.lotId } : {}),
  };
}

// Respuesta de /access/permissions/sync lista para reemplazar el cache.
// Null si la respuesta no trae las dos listas: no es un padron vacio, es
// una respuesta rota, y el cache anterior tiene que quedar. Una lista
// vacia si es valida y vacia el cache (todos dados de baja).
// Filas sin los campos de franja se descartan: ese trabajador sale como
// WORKER_NOT_SYNCED, que es fail-closed.
export function toWorkerCacheSnapshot(
  data: components['schemas']['PermissionsSyncResponse'],
): WorkerCacheSnapshot | null {
  if (!Array.isArray(data.permissions) || !Array.isArray(data.enrolledUserIds)) return null;
  const permissions = data.permissions.flatMap((p): WorkerPermissionRow[] => {
    if (!p.userId || !p.jti || !p.lotId || !p.lotCode) return [];
    if (!p.weekdays?.length || !p.dailyFrom || !p.dailyUntil) return [];
    return [
      {
        userId: p.userId,
        jti: p.jti,
        lotId: p.lotId,
        lotCode: p.lotCode,
        weekdays: p.weekdays,
        dailyFrom: p.dailyFrom,
        dailyUntil: p.dailyUntil,
        timezone: p.timezone || null,
      },
    ];
  });
  return { permissions, enrolledUserIds: data.enrolledUserIds.filter((id) => id.length > 0) };
}

// weekdays viaja a SQLite como JSON. Algo que no sea una lista de enteros
// devuelve [] y scheduleContains lo evalua como fuera de franja.
export function parseWeekdays(text: string): number[] {
  try {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) return [];
    return value.filter((day): day is number => Number.isInteger(day));
  } catch {
    return [];
  }
}

// A quien pertenece el enrolamiento de un evento del outbox, leido del
// token: el trabajador por `s`, el invitado por `i`. Sin verificar firma:
// solo decide que fila local borrar cuando el server rechaza el DNI.
// Parse minimo del SP1 para no importar scanner/lib (ciclo). Un token
// corrupto devuelve null y no se borra nada: el sync no debe romper.
export function extractEnrollmentSubject(token: string): EnrollmentSubject | null {
  try {
    const body = token.startsWith('SP1.') ? token.slice(4) : token;
    const [payloadPart] = body.split('.');
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof json !== 'object' || json === null) return null;
    if ('st' in json && json.st === 'W') {
      return 's' in json && typeof json.s === 'string' ? { kind: 'worker', userId: json.s } : null;
    }
    return 'i' in json && typeof json.i === 'string' ? { kind: 'guest', invitationId: json.i } : null;
  } catch {
    return null;
  }
}
