import { describe, expect, it } from 'vitest';

import {
  backoffDelayFor,
  hasValidGate,
  isOutboxEvent,
  runSyncCycle,
  toSyncEvent,
} from '@/modules/offline/lib';
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

  it('acepta gateId=null (evento encolado antes de que el device tenga garita configurada)', () => {
    expect(isOutboxEvent({ ...event('e1'), gateId: null })).toBe(true);
  });

  it('rechaza gateId="" (misconfig: EXPO_PUBLIC_GATE_ID vacio produciria perdida silenciosa)', () => {
    expect(isOutboxEvent({ ...event('e1'), gateId: '' })).toBe(false);
  });
});

describe('hasValidGate', () => {
  // Predicado unico usado en isOutboxEvent, peek filter (sync.ts) y
  // toSyncEvent. Antes cada uno usaba una expresion distinta y la
  // desincronizacion dejaba pasar gateId="" a un mapping que lo tiraba,
  // con runSyncCycle borrando el clientEventId igual. Este test blinda
  // el contrato del helper.
  it('acepta strings no-vacios', () => {
    expect(hasValidGate('g1')).toBe(true);
    expect(hasValidGate('any-uuid-here')).toBe(true);
  });

  it('rechaza null, undefined y string vacio', () => {
    expect(hasValidGate(null)).toBe(false);
    expect(hasValidGate(undefined)).toBe(false);
    expect(hasValidGate('')).toBe(false);
  });

  it('rechaza tipos que no son string', () => {
    expect(hasValidGate(0)).toBe(false);
    expect(hasValidGate(false)).toBe(false);
    expect(hasValidGate({})).toBe(false);
  });
});

describe('toSyncEvent - guardia contra gateId invalido', () => {
  it('devuelve null cuando gateId es "" (no un mapping mentiroso al contrato)', () => {
    expect(toSyncEvent({ ...event('e1'), gateId: '' as unknown as string })).toBeNull();
  });
});

describe('runSyncCycle - regresion de perdida silenciosa por gateId invalido', () => {
  // Bug pre-fix: peek filtraba con `gateId !== null` (dejaba pasar ''),
  // send llamaba toSyncEvent que devolvia null para '' (el evento
  // desaparecia del body), el POST resolvia sin throw, y runSyncCycle
  // llamaba remove con el clientEventId original. El evento NUNCA viajaba
  // al server pero se borraba del outbox. Perdida silenciosa.
  //
  // Este test simula el ciclo completo con la logica saneada: el evento
  // con gateId invalido no debe salir del outbox aunque el ciclo termine
  // "sincronizado" para el resto.
  it('un evento con gateId invalido NO se remove del outbox aunque el batch se sincronice', async () => {
    const badEvent: OutboxEvent = { ...event('e-bad'), gateId: '' as unknown as string };
    const goodEvent = event('e-good');
    const queue = [badEvent, goodEvent];
    const sent: string[] = [];
    const removed: string[] = [];
    const deps: SyncCycleDeps = {
      // Mismo filter que el sync real (sync.ts): usa hasValidGate.
      peek: (limit) => queue.slice(0, limit).filter((e) => hasValidGate(e.gateId)),
      send: async (events) => {
        sent.push(...events.map((e) => e.clientEventId));
      },
      remove: (ids) => removed.push(...ids),
      markFailure: () => {},
    };

    const outcome = await runSyncCycle(deps, 50);

    expect(outcome).toBe('synced');
    // El evento sano viajo y se borro.
    expect(sent).toEqual(['e-good']);
    expect(removed).toEqual(['e-good']);
    // El critico: el evento con gateId invalido NI se envio NI se borro.
    // Antes del fix, no se enviaba pero SI se borraba. Data loss.
    expect(sent).not.toContain('e-bad');
    expect(removed).not.toContain('e-bad');
  });
});

describe('toSyncEvent', () => {
  it('mapea el evento de la cola al contrato de sync', () => {
    const mapped = toSyncEvent({ ...event('e1'), companions: 2 });
    expect(mapped).toEqual({
      clientEventId: 'e1',
      token: 'SP1.abc.def',
      gateId: 'g1',
      direction: 'IN',
      capturedAt: '2026-08-19T18:00:00.000Z',
      localDecision: 'ALLOWED',
      companions: 2,
    });
  });

  it('omite companions cuando es null', () => {
    const mapped = toSyncEvent(event('e1'));
    expect(mapped).not.toHaveProperty('companions');
  });

  it('devuelve null sin garita configurada: el evento se queda en la cola', () => {
    expect(toSyncEvent({ ...event('e1'), gateId: null })).toBeNull();
  });
});
