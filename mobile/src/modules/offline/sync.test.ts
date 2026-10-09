import { beforeEach, describe, expect, it, vi } from 'vitest';

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
