import type { components } from '@securepass/contracts';

import { toScanResult, validateOffline } from '@/modules/scanner/lib';
import type { LocalDecision } from '@/modules/offline/types';
import type { LotChoice, OfflineContext, OfflineScan, ParsedToken, ScanResult } from '@/modules/scanner/types';

// Mensaje del fail-closed cuando el server responde con un `result` que
// esta version no conoce. Le dice al guardia que hacer ahora (registro
// manual) y a quien avisar (soporte). No le pide "actualizar la app":
// en la garita no puede hacerlo, y ademas la causa puede ser un backend
// adelantado, no una app vieja.
export const UNKNOWN_RESULT_MESSAGE =
  'El sistema devolvió una respuesta que esta versión no reconoce. Registrá el ingreso manualmente y avisá a soporte.';

const SERVER_ERROR_MESSAGE =
  'El server rechazó el pase. Intentá de nuevo o registrá el ingreso manualmente.';

export type ValidateApiResponse = {
  data?: components['schemas']['ValidateAccessResponse'];
  error?: unknown;
};

export type OutboxInput = LocalDecision & {
  clientEventId: string;
  token: string;
  gateId: string | null;
  direction: 'IN';
  companions: number | null;
  capturedAt: string;
  documentNumber: string | null;
  lotId: string | null;
};

export type ScanFlowDeps = {
  postValidate: (input: {
    token: string;
    gateId: string;
    clientEventId: string;
    capturedAt: string;
    // WBS-119: lote elegido para un trabajador con franja en varios lotes.
    lotId?: string;
  }) => Promise<ValidateApiResponse>;
  buildOfflineContext: () => OfflineContext;
  recordLocalUse: (jti: string, context: OfflineContext) => void;
  enqueueOutboxEvent: (event: OutboxInput) => void;
  refreshPendingCount: () => void;
  gateId: string | null | undefined;
  hasValidGate: (gateId: unknown) => gateId is string;
  parseToken: (token: string) => ParsedToken | null;
};

export async function resolveScan(
  token: string,
  clientEventId: string,
  deps: ScanFlowDeps,
): Promise<ScanResult> {
  const capturedAt = new Date().toISOString();
  const { gateId } = deps;

  if (gateId) {
    try {
      const { data, error } = await deps.postValidate({
        token,
        gateId,
        clientEventId,
        capturedAt,
      });
      const outcome = data ? toScanResult(data, token) : ({ kind: 'empty' } as const);

      // Principio invariante: con red y respuesta valida del server, el
      // server gana SIEMPRE. El path offline (validateOffline, abajo) es
      // fallback para "no hubo red", nunca alternativa cuando el server
      // ya emitio un veredicto. Divergencias entre server y offline son
      // esperables (reloj drifteado, cache stale, revocados no sincronizados)
      // — el server es la fuente de verdad y su respuesta se respeta
      // aunque coincida por casualidad con lo que el offline habria dicho.
      // Ver #98 para el bug historico donde este invariante estaba roto.
      if (outcome.kind === 'result') return outcome.value;
      if (outcome.kind === 'unknown') {
        return { status: 'denied', reason: 'UNKNOWN', message: UNKNOWN_RESULT_MESSAGE };
      }
      if (error) {
        // Server respondio con error (no es caida de red): su veredicto manda.
        return { status: 'denied', reason: 'UNKNOWN', message: SERVER_ERROR_MESSAGE };
      }
      // outcome.kind === 'empty' && !error: respuesta vacia sin error
      // explicito. Raro pero benigno, cae al fallback offline.
    } catch {
      // Sin red: validacion offline.
    }
  }

  const context = deps.buildOfflineContext();
  const decision = validateOffline(token, context);

  if (decision.status === 'needs_enrollment') {
    // El scanner encara el flujo de DNI + POST /access/enroll; no se
    // registra ingreso todavia. Se pospone el enqueue del outbox hasta
    // que la decision real (allowed o denied) exista.
    return {
      status: 'needs_enrollment',
      subject: decision.subject,
      token,
      lotCode: null,
      // Offline no conoce el nombre: el QR no lleva PII (spec 5.1).
      // La pantalla de enrolamiento degrada al layout sin cruce visual.
      guestName: null,
      // Si el guardia cancela el DNI, el rechazo se encola con los datos
      // de este escaneo (NOT_ENROLLED).
      offlineScan: { clientEventId, capturedAt },
      // Sin red no hay lotes para elegir (H: el lote se informa, no se elige).
      lots: [],
    };
  }

  // WBS-119: varios lotes en franja -> el guardia elige antes de encolar.
  if (decision.status === 'allowed_worker' && decision.lots.length > 1) {
    return {
      status: 'needs_lot_selection',
      token,
      workerName: null,
      lots: decision.lots,
      offlineScan: { clientEventId, capturedAt },
    };
  }

  // El cupo es de la invitacion: el token del trabajador no lleva `m`.
  if (decision.status === 'allowed') {
    const parsed = deps.parseToken(token);
    if (parsed) deps.recordLocalUse(parsed.payload.j, context);
  }
  const local: LocalDecision =
    decision.status === 'denied'
      ? { localDecision: 'DENIED', localDenialReason: decision.reason }
      : { localDecision: 'ALLOWED' };

  deps.enqueueOutboxEvent({
    clientEventId,
    token,
    gateId: deps.hasValidGate(gateId) ? gateId : null,
    direction: 'IN',
    companions: null,
    capturedAt,
    ...local,
    documentNumber: null,
    // Un solo lote en franja: se manda ese.
    lotId: decision.status === 'allowed_worker' ? (decision.lots[0]?.lotId ?? null) : null,
  });
  deps.refreshPendingCount();

  if (decision.status === 'allowed') {
    // Offline no conoce nombre ni lote: el QR no lleva PII (spec 5.1).
    return { status: 'allowed', guestName: null, lotCode: null };
  }
  if (decision.status === 'allowed_worker') {
    return { status: 'allowed', guestName: null, lotCode: decision.lots[0]?.code ?? null };
  }
  return decision;
}

// El guardia cancelo el DNI de un escaneo decidido sin red: no entro, y
// el rechazo viaja con el clientEventId y la hora del escaneo original.
export function notEnrolledEvent(
  token: string,
  scan: OfflineScan,
  gateId: string | null,
): OutboxInput {
  return {
    clientEventId: scan.clientEventId,
    token,
    gateId,
    direction: 'IN',
    companions: null,
    capturedAt: scan.capturedAt,
    localDecision: 'DENIED',
    localDenialReason: 'NOT_ENROLLED',
    documentNumber: null,
    lotId: null,
  };
}

// Mensaje del 400 INVALID_LOT: el lote elegido ya no esta en la franja (o
// el permiso cambio entre el escaneo y la eleccion).
export const INVALID_LOT_MESSAGE =
  'Ese lote ya no esta en la franja del trabajador. Volvé a escanear el QR o registrá el ingreso manualmente.';

function isInvalidLot(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'INVALID_LOT';
}

// WBS-119: el guardia eligio el lote. Con red (lo pidio el server) se
// reenvia validate con ese lotId y un clientEventId nuevo: el pedido
// anterior no guardo nada. Sin red (o si se cae ahora) el ingreso va al
// outbox con el lotId; el sync evalua la franja en capturedAt.
export async function resolveLotChoice(
  token: string,
  lot: LotChoice,
  offlineScan: OfflineScan | null,
  newClientEventId: string,
  deps: ScanFlowDeps,
): Promise<ScanResult> {
  const { gateId } = deps;
  if (offlineScan === null && gateId) {
    try {
      const { data, error } = await deps.postValidate({
        token,
        gateId,
        clientEventId: newClientEventId,
        capturedAt: new Date().toISOString(),
        lotId: lot.lotId,
      });
      if (isInvalidLot(error)) return { status: 'denied', reason: 'UNKNOWN', message: INVALID_LOT_MESSAGE };
      const outcome = data ? toScanResult(data, token) : ({ kind: 'empty' } as const);
      if (outcome.kind === 'result') return outcome.value;
      if (outcome.kind === 'unknown') {
        return { status: 'denied', reason: 'UNKNOWN', message: UNKNOWN_RESULT_MESSAGE };
      }
      if (error) return { status: 'denied', reason: 'UNKNOWN', message: SERVER_ERROR_MESSAGE };
    } catch {
      // Se cayo la red entre el escaneo y la eleccion: va al outbox.
    }
  }
  const scan = offlineScan ?? { clientEventId: newClientEventId, capturedAt: new Date().toISOString() };
  deps.enqueueOutboxEvent({
    clientEventId: scan.clientEventId,
    token,
    gateId: deps.hasValidGate(gateId) ? gateId : null,
    direction: 'IN',
    companions: null,
    capturedAt: scan.capturedAt,
    localDecision: 'ALLOWED',
    documentNumber: null,
    lotId: lot.lotId,
  });
  deps.refreshPendingCount();
  return { status: 'allowed', guestName: null, lotCode: lot.code };
}
