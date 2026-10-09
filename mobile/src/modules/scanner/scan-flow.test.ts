import { getPublicKey, sign, utils } from '@noble/ed25519';
import { describe, expect, it, vi } from 'vitest';

import { parseToken } from '@/modules/scanner/lib';
import { notEnrolledEvent, resolveScan, UNKNOWN_RESULT_MESSAGE } from '@/modules/scanner/scan-flow';
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
      subject: { kind: 'guest', invitationId: 'inv-123' },
      token: 'SP1.token',
      lotCode: 'A-14',
      guestName: null,
      offlineScan: null,
      lots: [],
    });
    expect(deps.buildOfflineContext).not.toHaveBeenCalled();
    expect(deps.enqueueOutboxEvent).not.toHaveBeenCalled();
  });

  it('server responde NEEDS_LOT_SELECTION (securepassb#218): denied UNKNOWN, sin offline ni outbox', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockResolvedValue({
        data: {
          result: 'NEEDS_LOT_SELECTION',
          subjectKind: 'WORKER',
          worker: { userId: 'user-w', lots: [{ lotId: 'lot-1', code: 'L-1' }, { lotId: 'lot-2', code: 'L-2' }] },
        },
        error: undefined,
      }),
    });

    const outcome = await resolveScan('SP1.token', 'cid-1', deps);

    expect(outcome).toEqual({ status: 'denied', reason: 'UNKNOWN', message: UNKNOWN_RESULT_MESSAGE });
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
        workerPermissions: () => [],
        isWorkerEnrolled: () => true,
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

describe('resolveScan - trabajador sin red (WBS-118)', () => {
  const secretKey = utils.randomSecretKey();
  const b64 = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = new TextEncoder().encode(
    JSON.stringify({ v: 1, k: 'kid1', j: 'jti-w', n: 'barrio', st: 'W', s: 'user-w' }),
  );
  const token = `SP1.${b64(payload)}.${b64(sign(payload, secretKey))}`;
  // Martes 10:00 en Mendoza.
  const now = Math.floor(new Date('2026-03-03T13:00:00Z').getTime() / 1000);
  const permission = (lotCode: string) => ({
    jti: 'jti-w',
    lotCode,
    weekdays: [2],
    dailyFrom: '08:00',
    dailyUntil: '12:00',
    timezone: 'America/Argentina/Mendoza',
  });

  it('en franja: encola ALLOWED, no consume cupo y muestra los lotes en franja', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockRejectedValue(new Error('network down')),
      parseToken,
      buildOfflineContext: vi.fn().mockReturnValue({
        now,
        keys: { kid1: b64(getPublicKey(secretKey)) },
        revoked: new Set<string>(),
        localUses: () => 0,
        isEnrolled: () => false,
        neighborhoodTimezone: null,
        workerPermissions: () => [permission('M4-L12'), permission('M9-L01')],
        isWorkerEnrolled: () => true,
      }),
    });

    const outcome = await resolveScan(token, 'cid-w', deps);

    expect(outcome).toEqual({ status: 'allowed', guestName: null, lotCode: 'M4-L12, M9-L01' });
    expect(deps.recordLocalUse).not.toHaveBeenCalled();
    expect(deps.enqueueOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ clientEventId: 'cid-w', token, localDecision: 'ALLOWED' }),
    );
  });

  it('no enrolado: pide DNI del trabajador y no encola nada', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockRejectedValue(new Error('network down')),
      buildOfflineContext: vi.fn().mockReturnValue({
        now,
        keys: { kid1: b64(getPublicKey(secretKey)) },
        revoked: new Set<string>(),
        localUses: () => 0,
        isEnrolled: () => true,
        neighborhoodTimezone: null,
        workerPermissions: () => [permission('M4-L12')],
        isWorkerEnrolled: () => false,
      }),
    });

    const outcome = await resolveScan(token, 'cid-w', deps);

    expect(outcome).toEqual({
      status: 'needs_enrollment',
      subject: { kind: 'worker', userId: 'user-w' },
      token,
      lotCode: null,
      guestName: null,
      offlineScan: { clientEventId: 'cid-w', capturedAt: expect.any(String) },
      lots: [],
    });
    expect(deps.enqueueOutboxEvent).not.toHaveBeenCalled();
  });

  it('fuera de franja: encola DENIED con el motivo local', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockRejectedValue(new Error('network down')),
      buildOfflineContext: vi.fn().mockReturnValue({
        now,
        keys: { kid1: b64(getPublicKey(secretKey)) },
        revoked: new Set<string>(),
        localUses: () => 0,
        isEnrolled: () => true,
        neighborhoodTimezone: null,
        workerPermissions: () => [{ ...permission('M4-L12'), weekdays: [5] }],
        isWorkerEnrolled: () => true,
      }),
    });

    await resolveScan(token, 'cid-w', deps);

    expect(deps.enqueueOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEventId: 'cid-w',
        localDecision: 'DENIED',
        localDenialReason: 'OUT_OF_SCHEDULE',
      }),
    );
  });
});

describe('resolveScan - motivo local en el outbox', () => {
  it('sin red y token invalido: encola DENIED con INVALID_SIGNATURE', async () => {
    const deps = makeDeps({
      postValidate: vi.fn().mockRejectedValue(new Error('network down')),
    });

    await resolveScan('no-es-un-token', 'cid-x', deps);

    expect(deps.enqueueOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEventId: 'cid-x',
        localDecision: 'DENIED',
        localDenialReason: 'INVALID_SIGNATURE',
      }),
    );
  });
});

describe('notEnrolledEvent', () => {
  it('arma el DENIED NOT_ENROLLED con el id y la hora del escaneo original', () => {
    const scan = { clientEventId: 'cid-scan', capturedAt: '2026-10-01T12:00:00.000Z' };
    expect(notEnrolledEvent('SP1.token', scan, 'gate-1')).toEqual({
      clientEventId: 'cid-scan',
      token: 'SP1.token',
      gateId: 'gate-1',
      direction: 'IN',
      companions: null,
      capturedAt: '2026-10-01T12:00:00.000Z',
      localDecision: 'DENIED',
      localDenialReason: 'NOT_ENROLLED',
      documentNumber: null,
    });
  });
});
