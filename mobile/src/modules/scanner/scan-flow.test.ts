import { describe, expect, it, vi } from 'vitest';

import { resolveScan, UNKNOWN_RESULT_MESSAGE } from '@/modules/scanner/scan-flow';
import type { ScanFlowDeps } from '@/modules/scanner/scan-flow';

function makeDeps(overrides: Partial<ScanFlowDeps> = {}): ScanFlowDeps {
  const base: ScanFlowDeps = {
    postValidate: vi.fn().mockResolvedValue({ data: undefined, error: undefined }),
    buildOfflineContext: vi.fn().mockReturnValue({
      now: 0,
      keys: {},
      revoked: new Set<string>(),
      localUses: () => 0,
      isEnrolled: () => false,
      neighborhoodTimezone: null,
    }),
    recordLocalUse: vi.fn(),
    enqueueOutboxEvent: vi.fn(),
    refreshPendingCount: vi.fn(),
    gateId: 'gate-1',
    hasValidGate: ((value: unknown): value is string =>
      typeof value === 'string' && value.length > 0) as ScanFlowDeps['hasValidGate'],
    parseToken: vi.fn().mockReturnValue(null),
  };
  return { ...base, ...overrides };
}

describe('resolveScan', () => {
  it('server responde NEEDS_ENROLLMENT: no llama al offline, devuelve needs_enrollment con lotCode del server', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockResolvedValue({
        data: {
          result: 'NEEDS_ENROLLMENT',
          invitationId: 'inv-123',
          lot: { code: 'A-14' },
        },
        error: undefined,
      }),
    });

    const outcome = await resolveScan('SP1.token', 'cid-1', deps);

    expect(outcome).toEqual({
      status: 'needs_enrollment',
      invitationId: 'inv-123',
      token: 'SP1.token',
      lotCode: 'A-14',
    });
    expect(deps.buildOfflineContext).not.toHaveBeenCalled();
    expect(deps.enqueueOutboxEvent).not.toHaveBeenCalled();
  });

  it('server responde con result desconocido: no llama al offline, devuelve denied UNKNOWN', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockResolvedValue({
        data: { result: 'PENDING_APPROVAL' },
        error: undefined,
      }),
    });

    const outcome = await resolveScan('SP1.token', 'cid-1', deps);

    expect(outcome).toEqual({
      status: 'denied',
      reason: 'UNKNOWN',
      message: UNKNOWN_RESULT_MESSAGE,
    });
    expect(deps.buildOfflineContext).not.toHaveBeenCalled();
    expect(deps.enqueueOutboxEvent).not.toHaveBeenCalled();
  });

  // Regresion #98 — este es el escenario que justifica la prioridad del ticket.
  //
  // Antes del fix, cuando toScanResult veia un `result` que no era ALLOWED ni
  // DENIED (empezando por NEEDS_ENROLLMENT, que el server ya emitia), devolvia
  // null y el caller caia al path offline. Si el cache local decia
  // isEnrolled=true (invitacion desenrolada server-side, cache stale), el
  // offline resolvia `allowed` y encolaba un evento con documentNumber=null,
  // registrando ingreso sin captura de DNI — el mismo modo de falla que #87
  // se ocupa de blindar en el path online del enrolamiento. Es el bug real
  // detras del sintoma "tapado por coincidencia" del reporte: cuando el
  // cache no divergia del server el fallback ateraba en la misma decision y
  // no habia sintoma visible.
  //
  // Con el fix, el veredicto del server manda y validateOffline no corre.
  // Este test rompe si alguien reintroduce el fallback silencioso.
  it('regresion #98/#87: cache dice isEnrolled=true + server NEEDS_ENROLLMENT -> gana el server, no se encola evento sin DNI', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockResolvedValue({
        data: { result: 'NEEDS_ENROLLMENT', invitationId: 'inv-123' },
        error: undefined,
      }),
      buildOfflineContext: vi.fn().mockReturnValue({
        now: 0,
        keys: {},
        revoked: new Set<string>(),
        localUses: () => 0,
        isEnrolled: () => true,
        neighborhoodTimezone: null,
      }),
    });

    const outcome = await resolveScan('SP1.token', 'cid-1', deps);

    expect(outcome.status).toBe('needs_enrollment');
    expect(deps.buildOfflineContext).not.toHaveBeenCalled();
    expect(deps.enqueueOutboxEvent).not.toHaveBeenCalled();
  });

  it('server responde ALLOWED: no llama al offline, devuelve el veredicto del server', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockResolvedValue({
        data: { result: 'ALLOWED', guest: { name: 'Ana' }, lot: { code: 'B-2' } },
        error: undefined,
      }),
    });

    const outcome = await resolveScan('SP1.token', 'cid-1', deps);

    expect(outcome).toEqual({ status: 'allowed', guestName: 'Ana', lotCode: 'B-2' });
    expect(deps.buildOfflineContext).not.toHaveBeenCalled();
  });

  it('sin red (postValidate throwa): cae al fallback offline', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockRejectedValue(new Error('network down')),
    });

    await resolveScan('SP1.token', 'cid-1', deps);

    expect(deps.buildOfflineContext).toHaveBeenCalledOnce();
  });

  it('server responde con error explicito: denied UNKNOWN, no cae al offline', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockResolvedValue({ data: undefined, error: { status: 500 } }),
    });

    const outcome = await resolveScan('SP1.token', 'cid-1', deps);

    expect(outcome).toMatchObject({ status: 'denied', reason: 'UNKNOWN' });
    expect(deps.buildOfflineContext).not.toHaveBeenCalled();
  });
});
