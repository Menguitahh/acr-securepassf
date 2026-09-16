import { describe, expect, it } from 'vitest';

import {
  backoffDelayFor,
  classifyOrphanOutboxRows,
  hasValidGate,
  isOutboxEvent,
  runSyncCycle,
  toSyncEvent,
  type OutboxOrphanRow,
  type SyncCycleDeps,
} from '@/modules/offline/lib';
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

describe('classifyOrphanOutboxRows (#83)', () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  // Referencia estable: 2026-09-09 00:00:00 UTC.
  const NOW_MS = Date.parse('2026-09-09T00:00:00.000Z');

  function row(
    clientEventId: string,
    gateIdField: string | null | 'ABSENT' | 'CORRUPT',
    createdAt: string,
  ): OutboxOrphanRow {
    let payload: string;
    if (gateIdField === 'ABSENT') {
      payload = JSON.stringify({ clientEventId, token: 'SP1.x.y' });
    } else if (gateIdField === 'CORRUPT') {
      payload = '{"gateId": "'; // JSON invalido
    } else {
      payload = JSON.stringify({ clientEventId, token: 'SP1.x.y', gateId: gateIdField });
    }
    return { clientEventId, payload, createdAt };
  }

  // El test que pidio la review antes del DELETE (#83): una fila VALIDA
  // no se borra bajo ninguna combinacion de edad. Un evento con garita
  // real de hace 6 meses es un ingreso pendiente de sincronizar, no
  // basura. Si este test rompe, el prune esta borrando datos operativos.
  it('NUNCA borra una fila con gateId real, aunque tenga 6 meses de edad', () => {
    const sixMonthsAgo = new Date(NOW_MS - 180 * 24 * 60 * 60 * 1000).toISOString();
    const result = classifyOrphanOutboxRows(
      [row('e-valid-old', 'gate-real-uuid', sixMonthsAgo)],
      NOW_MS,
      SEVEN_DAYS_MS,
    );
    expect(result.removeEmpty).toEqual([]);
    expect(result.removeStale).toEqual([]);
  });

  it('NUNCA borra filas validas independientemente de la edad ni de la mezcla con huerfanos', () => {
    const rows: OutboxOrphanRow[] = [
      row('e-fresh', 'gate-a', new Date(NOW_MS - 60 * 1000).toISOString()),
      row('e-week', 'gate-b', new Date(NOW_MS - 8 * 24 * 60 * 60 * 1000).toISOString()),
      row('e-year', 'gate-c', new Date(NOW_MS - 365 * 24 * 60 * 60 * 1000).toISOString()),
      // Huerfanos mezclados: se borran, pero los validos quedan intactos.
      row('e-empty', '', new Date(NOW_MS - 60 * 1000).toISOString()),
      row('e-null-old', null, new Date(NOW_MS - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ];

    const result = classifyOrphanOutboxRows(rows, NOW_MS, SEVEN_DAYS_MS);

    for (const id of ['e-fresh', 'e-week', 'e-year']) {
      expect(result.removeEmpty).not.toContain(id);
      expect(result.removeStale).not.toContain(id);
    }
    expect(result.removeEmpty).toEqual(['e-empty']);
    expect(result.removeStale).toEqual(['e-null-old']);
  });

  it('borra siempre las filas con gateId="", sin importar la edad', () => {
    const rows: OutboxOrphanRow[] = [
      row('e-empty-fresh', '', new Date(NOW_MS - 60 * 1000).toISOString()),
      row('e-empty-old', '', new Date(NOW_MS - 365 * 24 * 60 * 60 * 1000).toISOString()),
    ];
    const result = classifyOrphanOutboxRows(rows, NOW_MS, SEVEN_DAYS_MS);
    expect(result.removeEmpty).toEqual(['e-empty-fresh', 'e-empty-old']);
    expect(result.removeStale).toEqual([]);
  });

  it('mantiene filas con gateId=null recientes (setup en progreso)', () => {
    const rows: OutboxOrphanRow[] = [
      row('e-null-6d', null, new Date(NOW_MS - 6 * 24 * 60 * 60 * 1000).toISOString()),
      row('e-null-1d', null, new Date(NOW_MS - 24 * 60 * 60 * 1000).toISOString()),
    ];
    const result = classifyOrphanOutboxRows(rows, NOW_MS, SEVEN_DAYS_MS);
    expect(result.removeEmpty).toEqual([]);
    expect(result.removeStale).toEqual([]);
  });

  it('borra filas con gateId=null anteriores al umbral', () => {
    const rows: OutboxOrphanRow[] = [
      row('e-null-8d', null, new Date(NOW_MS - 8 * 24 * 60 * 60 * 1000).toISOString()),
      row('e-null-90d', null, new Date(NOW_MS - 90 * 24 * 60 * 60 * 1000).toISOString()),
    ];
    const result = classifyOrphanOutboxRows(rows, NOW_MS, SEVEN_DAYS_MS);
    expect(result.removeStale).toEqual(['e-null-8d', 'e-null-90d']);
  });

  it('trata payload corrupto como null (borra por edad, misma cautela)', () => {
    const rows: OutboxOrphanRow[] = [
      row('e-corrupt-fresh', 'CORRUPT', new Date(NOW_MS - 60 * 1000).toISOString()),
      row('e-corrupt-old', 'CORRUPT', new Date(NOW_MS - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ];
    const result = classifyOrphanOutboxRows(rows, NOW_MS, SEVEN_DAYS_MS);
    // El corrupto reciente sigue en cola (por si es un bug transitorio).
    expect(result.removeStale).toEqual(['e-corrupt-old']);
    expect(result.removeEmpty).toEqual([]);
  });

  it('trata gateId ausente como null (payload viejo sin el campo)', () => {
    const rows: OutboxOrphanRow[] = [
      row('e-absent-fresh', 'ABSENT', new Date(NOW_MS - 60 * 1000).toISOString()),
      row('e-absent-old', 'ABSENT', new Date(NOW_MS - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ];
    const result = classifyOrphanOutboxRows(rows, NOW_MS, SEVEN_DAYS_MS);
    expect(result.removeStale).toEqual(['e-absent-old']);
  });

  it('cola vacia devuelve counts en cero', () => {
    expect(classifyOrphanOutboxRows([], NOW_MS, SEVEN_DAYS_MS)).toEqual({
      removeEmpty: [],
      removeStale: [],
    });
  });
});
