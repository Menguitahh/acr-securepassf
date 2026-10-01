import type { components } from '@securepass/contracts';

import { toScanResult, validateOffline } from '@/modules/scanner/lib';
import type { OfflineContext, ParsedToken, ScanResult } from '@/modules/scanner/types';

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

export type OutboxInput = {
  clientEventId: string;
  token: string;
  gateId: string | null;
  direction: 'IN';
  companions: number | null;
  capturedAt: string;
  localDecision: 'ALLOWED' | 'DENIED';
  documentNumber: string | null;
};

export type ScanFlowDeps = {
  postValidate: (input: {
    token: string;
    gateId: string;
    clientEventId: string;
    capturedAt: string;
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
    };
  }

  // El cupo es de la invitacion: el token del trabajador no lleva `m`.
  if (decision.status === 'allowed') {
    const parsed = deps.parseToken(token);
    if (parsed) deps.recordLocalUse(parsed.payload.j, context);
  }
  const allowed = decision.status === 'allowed' || decision.status === 'allowed_worker';

  deps.enqueueOutboxEvent({
    clientEventId,
    token,
    gateId: deps.hasValidGate(gateId) ? gateId : null,
    direction: 'IN',
    companions: null,
    capturedAt,
    localDecision: allowed ? 'ALLOWED' : 'DENIED',
    documentNumber: null,
  });
  deps.refreshPendingCount();

  if (decision.status === 'allowed') {
    // Offline no conoce nombre ni lote: el QR no lleva PII (spec 5.1).
    return { status: 'allowed', guestName: null, lotCode: null };
  }
  if (decision.status === 'allowed_worker') {
    // Los lotes en franja, como informacion. El guardia no elige: la
    // eleccion no llegaria al backend (WBS-119 espera lotId).
    return { status: 'allowed', guestName: null, lotCode: decision.lotCodes.join(', ') };
  }
  return decision;
}
