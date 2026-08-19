import { describe, expect, it } from 'vitest';

import { backoffDelayFor, isOutboxEvent, runSyncCycle } from '@/modules/offline/lib';
import type { SyncCycleDeps } from '@/modules/offline/lib';
import type { OutboxEvent } from '@/modules/offline/types';

const event = (clientEventId: string): OutboxEvent => ({
  clientEventId,
  token: 'SP1.abc.def',
  gateId: 'g1',
  direction: 'IN',
  companions: null,
  capturedAt: '2026-08-19T18:00:00.000Z',
  localDecision: 'ALLOWED',
});

function makeDeps(overrides: Partial<SyncCycleDeps> = {}): SyncCycleDeps & {
  removed: string[];
  failures: number;
} {
  const queue = [event('e1'), event('e2')];
  const deps: SyncCycleDeps & { removed: string[]; failures: number } = {
    peek: (limit) => queue.slice(0, limit),
    send: async () => {},
    remove: (ids) => deps.removed.push(...ids),
    markFailure: () => {
      deps.failures += 1;
    },
    removed: [],
    failures: 0,
    ...overrides,
  };
  return deps;
}

describe('backoffDelayFor', () => {
  it('sigue la escalera de spec 8.4', () => {
    expect(backoffDelayFor(0)).toBe(5000);
    expect(backoffDelayFor(1)).toBe(15000);
    expect(backoffDelayFor(2)).toBe(60000);
    expect(backoffDelayFor(3)).toBe(300000);
  });

  it('capa en 5 minutos por arriba del ultimo escalon', () => {
    expect(backoffDelayFor(10)).toBe(300000);
    expect(backoffDelayFor(99)).toBe(300000);
  });
});

describe('runSyncCycle - cola con red simulada', () => {
  it('no borra nada ni pierde eventos si la red esta caida', async () => {
    const deps = makeDeps({
      send: async () => {
        throw new Error('network down');
      },
    });

    const outcome = await runSyncCycle(deps, 50);

    expect(outcome).toBe('error');
    expect(deps.removed).toEqual([]);
    expect(deps.failures).toBe(1);
  });

  it('borra el batch enviado cuando el server responde', async () => {
    const sent: OutboxEvent[] = [];
    const deps = makeDeps({
      send: async (events) => {
        sent.push(...events);
      },
    });

    const outcome = await runSyncCycle(deps, 50);

    expect(outcome).toBe('synced');
    expect(sent.map((e) => e.clientEventId)).toEqual(['e1', 'e2']);
    expect(deps.removed).toEqual(['e1', 'e2']);
    expect(deps.failures).toBe(0);
  });

  it('no hace nada con la cola vacia', async () => {
    const deps = makeDeps({
      peek: () => [],
      send: async () => {
        throw new Error('no deberia enviar');
      },
    });

    const outcome = await runSyncCycle(deps, 50);

    expect(outcome).toBe('empty');
    expect(deps.removed).toEqual([]);
    expect(deps.failures).toBe(0);
  });

  it('respeta el limite del batch', async () => {
    const queue = [event('e1'), event('e2'), event('e3')];
    const sent: OutboxEvent[] = [];
    const deps = makeDeps({
      peek: (limit) => queue.slice(0, limit),
      send: async (events) => {
        sent.push(...events);
      },
    });

    await runSyncCycle(deps, 2);

    expect(sent.map((e) => e.clientEventId)).toEqual(['e1', 'e2']);
  });
});

describe('isOutboxEvent', () => {
  it('acepta un evento valido', () => {
    expect(isOutboxEvent(event('e1'))).toBe(true);
  });

  it('rechaza formas invalidas', () => {
    expect(isOutboxEvent(null)).toBe(false);
    expect(isOutboxEvent({ ...event('e1'), direction: 'SIDEWAYS' })).toBe(false);
    expect(isOutboxEvent({ ...event('e1'), localDecision: 'MAYBE' })).toBe(false);
    expect(isOutboxEvent({ clientEventId: 'e1' })).toBe(false);
  });
});
