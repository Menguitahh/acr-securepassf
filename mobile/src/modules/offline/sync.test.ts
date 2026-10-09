import { beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetEnrollment } from '@/modules/offline/enrollments-cache';
import { classifyResults } from '@/modules/offline/sync';
import type { OutboxEvent } from '@/modules/offline/types';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
vi.mock('@/common/api/client', () => ({ api: {} }));
vi.mock('@/modules/offline/outbox', () => ({}));
vi.mock('@/modules/offline/enrollments-cache', () => ({ forgetEnrollment: vi.fn() }));
vi.mock('@/modules/offline/worker-cache', () => ({ forgetWorkerEnrollment: vi.fn() }));

const event = (clientEventId: string): OutboxEvent => ({
  clientEventId,
  token: 'SP1.abc.def',
  gateId: 'g1',
  direction: 'IN',
  companions: null,
  capturedAt: '2026-10-01T12:00:00.000Z',
  localDecision: 'DENIED',
  localDenialReason: 'NOT_ENROLLED',
  documentNumber: null,
});

const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  errorLog.mockClear();
});

describe('classifyResults', () => {
  it('REJECTED INVALID_LOCAL_DECISION: sale de la cola y queda logueado con su clientEventId', () => {
    const outcome = classifyResults(
      [event('e1'), event('e2')],
      [
        { clientEventId: 'e1', result: 'REJECTED', rejection: 'INVALID_LOCAL_DECISION' },
        { clientEventId: 'e2', result: 'DENIED', reason: 'NOT_ENROLLED' },
      ],
    );

    expect(outcome).toEqual({ remove: ['e1', 'e2'], retry: [] });
    expect(errorLog).toHaveBeenCalledOnce();
    expect(errorLog.mock.calls[0]?.[0]).toContain('e1');
    expect(errorLog.mock.calls[0]?.[0]).toContain('INVALID_LOCAL_DECISION');
  });

  it('un DENIED normal no se loguea como bug del cliente', () => {
    classifyResults([event('e1')], [{ clientEventId: 'e1', result: 'DENIED', reason: 'REVOKED' }]);
    expect(errorLog).not.toHaveBeenCalled();
  });
});

// #179: el enrolamiento de invitado hecho sin red queda en el cache del
// telefono. Si el server no lo confirma, la fila tiene que irse: si no, ese
// telefono deja pasar sin red al invitado sin volver a pedir el DNI.
describe('classifyResults: enrolamiento de invitado sin confirmar (#179)', () => {
  const guestToken = `SP1.${btoa(JSON.stringify({ v: 1, i: 'inv-9' }))}.sig`;
  const enrollEvent = (id: string): OutboxEvent => ({
    ...event(id),
    token: guestToken,
    localDecision: 'ALLOWED',
    documentNumber: '30123456',
  });

  beforeEach(() => vi.mocked(forgetEnrollment).mockClear());

  it.each(['DENIED', 'REJECTED'] as const)('%s borra el enrolamiento local', (result) => {
    classifyResults([enrollEvent('e1')], [{ clientEventId: 'e1', result, reason: 'EXPIRED' }]);
    expect(forgetEnrollment).toHaveBeenCalledWith('inv-9');
  });

  it('ENROLLED lo deja', () => {
    classifyResults([enrollEvent('e1')], [{ clientEventId: 'e1', result: 'ENROLLED' }]);
    expect(forgetEnrollment).not.toHaveBeenCalled();
  });

  it('un evento sin DNI no toca el cache aunque venga DENIED', () => {
    classifyResults([event('e1')], [{ clientEventId: 'e1', result: 'DENIED', reason: 'NOT_ENROLLED' }]);
    expect(forgetEnrollment).not.toHaveBeenCalled();
  });
});
