import { describe, expect, it } from 'vitest';

import {
  backoffDelayFor,
  classifyOrphanOutboxRows,
  extractEnrollmentSubject,
  hasValidGate,
  parseOutboxEvent,
  parseWeekdays,
  runSyncCycle,
  reconcileGuestEnrollments,
  toSyncEvent,
  toWorkerCacheSnapshot,
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
  documentNumber: null,
});

function makeDeps(overrides: Partial<SyncCycleDeps> = {}): SyncCycleDeps & {
  removed: string[];
  failed: string[];
} {
  const queue = [event('e1'), event('e2')];
  const deps: SyncCycleDeps & { removed: string[]; failed: string[] } = {
    peek: (limit) => queue.slice(0, limit),
    // Default: server acepta todos, ninguno a retry.
    send: async (events) => ({
      remove: events.map((e) => e.clientEventId),
      retry: [],
    }),
    remove: (ids) => deps.removed.push(...ids),
    markFailure: (ids) => deps.failed.push(...ids),
    removed: [],
    failed: [],
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
    // markFailure recibe SOLO los ids del batch que fallo, no globalmente
    // (fix del poison pill: antes se incrementaba attempts en toda la cola).
    expect(deps.failed).toEqual(['e1', 'e2']);
  });

  it('borra el batch enviado cuando el server responde', async () => {
    const sent: OutboxEvent[] = [];
    const deps = makeDeps({
      send: async (events) => {
        sent.push(...events);
        return { remove: events.map((e) => e.clientEventId), retry: [] };
      },
    });

    const outcome = await runSyncCycle(deps, 50);

    expect(outcome).toBe('synced');
    expect(sent.map((e) => e.clientEventId)).toEqual(['e1', 'e2']);
    expect(deps.removed).toEqual(['e1', 'e2']);
    expect(deps.failed).toEqual([]);
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
    expect(deps.failed).toEqual([]);
  });

  it('respeta el limite del batch', async () => {
    const queue = [event('e1'), event('e2'), event('e3')];
    const sent: OutboxEvent[] = [];
    const deps = makeDeps({
      peek: (limit) => queue.slice(0, limit),
      send: async (events) => {
        sent.push(...events);
        return { remove: events.map((e) => e.clientEventId), retry: [] };
      },
    });

    await runSyncCycle(deps, 2);

    expect(sent.map((e) => e.clientEventId)).toEqual(['e1', 'e2']);
  });

  it('respeta el split remove/retry per-evento del server', async () => {
    // El server acepta e1, marca e2 como retry (rechazo transitorio).
    const deps = makeDeps({
      send: async () => ({ remove: ['e1'], retry: ['e2'] }),
    });

    const outcome = await runSyncCycle(deps, 50);

    expect(outcome).toBe('synced');
    expect(deps.removed).toEqual(['e1']);
    expect(deps.failed).toEqual(['e2']);
  });

  it('panica si send reporta un clientEventId fuera del batch (bug estructural)', async () => {
    // Guardia estructural: send no puede referirse a ids que no le
    // fueron pasados. Si lo hace, el mapping esta roto — throw en vez
    // de silenciar. Cubre casos como send reusando ids de otro batch
    // o inventando un id fantasma.
    const deps = makeDeps({
      send: async () => ({ remove: ['e1', 'e-inventado'], retry: [] }),
    });

    await expect(runSyncCycle(deps, 50)).rejects.toThrow(/no estaba en el batch/);
    // Guard corre ANTES de tocar el outbox: cero remove, cero markFailure.
    expect(deps.removed).toEqual([]);
    expect(deps.failed).toEqual([]);
  });
});

describe('parseOutboxEvent', () => {
  it('acepta un evento valido', () => {
    expect(parseOutboxEvent(event('e1'))).not.toBeNull();
  });

  // WBS-119: el lote elegido sin red tiene que sobrevivir la lectura del
  // outbox y viajar en el sync.
  it('conserva el guardId del que encolo y lo manda en el sync (#120)', () => {
    const parsed = parseOutboxEvent({ ...event('e1'), guardId: 'guard-a' });
    expect(parsed && toSyncEvent(parsed)).toMatchObject({ guardId: 'guard-a' });
    const viejo = parseOutboxEvent(event('e2'));
    expect(viejo && toSyncEvent(viejo)).not.toHaveProperty('guardId');
  });

  it('conserva el lotId elegido y lo manda en el sync', () => {
    const parsed = parseOutboxEvent({ ...event('e1'), lotId: 'lot-14' });
    expect(parsed?.lotId).toBe('lot-14');
    expect(parsed && toSyncEvent(parsed)).toMatchObject({ lotId: 'lot-14' });
    expect(parseOutboxEvent(event('e2'))?.lotId).toBeNull();
  });

  it('rechaza formas invalidas', () => {
    expect(parseOutboxEvent(null)).toBeNull();
    expect(parseOutboxEvent({ ...event('e1'), direction: 'SIDEWAYS' })).toBeNull();
    expect(parseOutboxEvent({ ...event('e1'), localDecision: 'MAYBE' })).toBeNull();
    expect(parseOutboxEvent({ clientEventId: 'e1' })).toBeNull();
  });

  it('acepta gateId=null (evento encolado antes de que el device tenga garita configurada)', () => {
    expect(parseOutboxEvent({ ...event('e1'), gateId: null })).not.toBeNull();
  });

  it('rechaza gateId="" (misconfig: EXPO_PUBLIC_GATE_ID vacio produciria perdida silenciosa)', () => {
    expect(parseOutboxEvent({ ...event('e1'), gateId: '' })).toBeNull();
  });

  it('acepta documentNumber string en un evento de enrolamiento offline (#27)', () => {
    expect(parseOutboxEvent({ ...event('e1'), documentNumber: '30123456' })).not.toBeNull();
  });

  it('acepta documentNumber=null (evento de acceso normal, sin enrolamiento)', () => {
    expect(parseOutboxEvent({ ...event('e1'), documentNumber: null })).not.toBeNull();
  });

  it('rechaza documentNumber="" (misconfig o payload corrupto)', () => {
    expect(parseOutboxEvent({ ...event('e1'), documentNumber: '' })).toBeNull();
  });

  it('rechaza documentNumber ausente (payload viejo sin migrar)', () => {
    const { documentNumber: _drop, ...withoutDoc } = event('e1');
    void _drop;
    expect(parseOutboxEvent(withoutDoc)).toBeNull();
  });
  it('conserva el motivo de un DENIED', () => {
    const denied = { ...event('e1'), localDecision: 'DENIED', localDenialReason: 'REVOKED' };
    expect(parseOutboxEvent(denied)).toMatchObject({
      localDecision: 'DENIED',
      localDenialReason: 'REVOKED',
    });
  });

  it('fila DENIED vieja sin motivo: sale como UNKNOWN, no se descarta', () => {
    expect(parseOutboxEvent({ ...event('e1'), localDecision: 'DENIED' })).toMatchObject({
      clientEventId: 'e1',
      localDecision: 'DENIED',
      localDenialReason: 'UNKNOWN',
    });
  });

  it('DENIED con un motivo que el contrato no conoce: UNKNOWN', () => {
    const odd = { ...event('e1'), localDecision: 'DENIED', localDenialReason: 'toString' };
    expect(parseOutboxEvent(odd)).toMatchObject({ localDenialReason: 'UNKNOWN' });
  });

  it('ALLOWED nunca lleva motivo, aunque la fila traiga uno', () => {
    const stray = { ...event('e1'), localDenialReason: 'REVOKED' };
    expect(parseOutboxEvent(stray)).not.toHaveProperty('localDenialReason');
  });
});

describe('hasValidGate', () => {
  // Predicado unico usado en parseOutboxEvent, peek filter (sync.ts) y
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
        return { remove: events.map((e) => e.clientEventId), retry: [] };
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

describe('toSyncEvent - invariante estructural #27', () => {
  // Regresion critica del composite: si toSyncEvent deja de incluir
  // documentNumber (bug o refactor), el server recibe el evento como
  // acceso normal y registra el ingreso SIN el enrolamiento. El cache
  // local dice enrolado pero el server no — data corruption silenciosa,
  // proximo scan del mismo QR va a fallar en /validate. El invariante:
  // enrolamiento offline encolado con DNI => enrolamiento offline llega
  // al server con DNI.
  it('un evento con documentNumber MAPEA el DNI en el body del contrato', () => {
    const mapped = toSyncEvent({ ...event('e-enroll'), documentNumber: '30123456' });
    expect(mapped).not.toBeNull();
    expect(mapped?.documentNumber).toBe('30123456');
    // El resto de campos siguen mapeando normal.
    expect(mapped?.clientEventId).toBe('e-enroll');
    expect(mapped?.gateId).toBe('g1');
  });

  it('un evento sin documentNumber (acceso normal) NO incluye el campo en el body', () => {
    const mapped = toSyncEvent(event('e-access'));
    expect(mapped).not.toBeNull();
    expect(mapped).not.toHaveProperty('documentNumber');
  });
});

describe('runSyncCycle - regresion #27 enrolamiento offline viaja con DNI', () => {
  it('un evento con documentNumber NO viaja al server sin el DNI', async () => {
    // Simula el ciclo completo con un solo evento de enrolamiento offline.
    // Si en algun momento toSyncEvent deja de incluir documentNumber (bug
    // o refactor), este test rompe. Ver comentario en toSyncEvent.
    const enrollmentEvent: OutboxEvent = { ...event('e-enroll'), documentNumber: '30123456' };
    const sentToServer: { clientEventId: string; documentNumber?: string }[] = [];
    const deps: SyncCycleDeps = {
      peek: (limit) => [enrollmentEvent].slice(0, limit),
      send: async (events) => {
        for (const e of events) {
          const mapped = toSyncEvent(e);
          if (mapped) sentToServer.push(mapped);
        }
        return { remove: events.map((e) => e.clientEventId), retry: [] };
      },
      remove: () => {},
      markFailure: () => {},
    };

    await runSyncCycle(deps, 50);

    expect(sentToServer).toHaveLength(1);
    expect(sentToServer[0]?.documentNumber).toBe('30123456');
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

  it('DENIED viaja con su motivo local', () => {
    const mapped = toSyncEvent({
      ...event('e1'),
      localDecision: 'DENIED',
      localDenialReason: 'NOT_ENROLLED',
    });
    expect(mapped).toMatchObject({ localDecision: 'DENIED', localDenialReason: 'NOT_ENROLLED' });
  });

  it('ALLOWED no manda localDenialReason', () => {
    expect(toSyncEvent(event('e1'))).not.toHaveProperty('localDenialReason');
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

describe('toWorkerCacheSnapshot', () => {
  const row = {
    userId: 'u1',
    jti: 'j1',
    lotId: 'l1',
    lotCode: 'M4-L12',
    weekdays: [1, 2],
    dailyFrom: '08:00',
    dailyUntil: '12:00',
    timezone: 'America/Argentina/Mendoza',
  };

  it('mapea las filas completas y los enrolados', () => {
    expect(toWorkerCacheSnapshot({ permissions: [row], enrolledUserIds: ['u1'] })).toEqual({
      permissions: [row],
      enrolledUserIds: ['u1'],
      enrolledInvitationIds: null,
    });
  });

  it('con enrolledInvitationIds (#179) los pasa sin vacios', () => {
    expect(
      toWorkerCacheSnapshot({ permissions: [], enrolledUserIds: [], enrolledInvitationIds: ['inv-1', ''] }),
    ).toMatchObject({ enrolledInvitationIds: ['inv-1'] });
  });

  it('listas vacias son un padron vacio, no una respuesta rota', () => {
    expect(toWorkerCacheSnapshot({ permissions: [], enrolledUserIds: [] })).toEqual({
      permissions: [],
      enrolledUserIds: [],
      enrolledInvitationIds: null,
    });
  });

  it('sin alguna de las dos listas la respuesta esta rota: null', () => {
    expect(toWorkerCacheSnapshot({ permissions: [row] })).toBeNull();
    expect(toWorkerCacheSnapshot({ enrolledUserIds: ['u1'] })).toBeNull();
    expect(toWorkerCacheSnapshot({})).toBeNull();
  });

  it('descarta filas sin identidad o sin franja; sin tz queda null', () => {
    const { userId: _u, ...sinUsuario } = row;
    const { timezone: _t, ...sinTz } = row;
    const snapshot = toWorkerCacheSnapshot({
      permissions: [sinUsuario, { ...row, weekdays: [] }, { ...row, dailyFrom: '' }, sinTz],
      enrolledUserIds: ['u1', ''],
    });
    expect(snapshot).toEqual({
      permissions: [{ ...row, timezone: null }],
      enrolledUserIds: ['u1'],
      enrolledInvitationIds: null,
    });
  });
});

describe('parseWeekdays', () => {
  it('lee la lista guardada y devuelve [] ante cualquier otra cosa', () => {
    expect(parseWeekdays('[1,3,5]')).toEqual([1, 3, 5]);
    expect(parseWeekdays('[1,"x",2.5,7]')).toEqual([1, 7]);
    expect(parseWeekdays('{"a":1}')).toEqual([]);
    expect(parseWeekdays('no es json')).toEqual([]);
  });
});

describe('extractEnrollmentSubject', () => {
  const token = (payload: object) =>
    `SP1.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.firma`;

  it('el token del trabajador identifica al usuario', () => {
    expect(extractEnrollmentSubject(token({ st: 'W', s: 'u1' }))).toEqual({ kind: 'worker', userId: 'u1' });
  });

  it('el token de invitacion identifica la invitacion', () => {
    expect(extractEnrollmentSubject(token({ i: 'inv-1', l: 'l1' }))).toEqual({
      kind: 'guest',
      invitationId: 'inv-1',
    });
  });

  it('un W sin usuario no cae a la rama de invitacion aunque traiga i', () => {
    expect(extractEnrollmentSubject(token({ st: 'W', i: 'inv-1' }))).toBeNull();
  });

  it('token corrupto devuelve null', () => {
    expect(extractEnrollmentSubject('SP1.!!!.x')).toBeNull();
    expect(extractEnrollmentSubject('')).toBeNull();
  });
});

describe('reconcileGuestEnrollments (#179)', () => {
  it('deja lo que confirma el server y lo pendiente del outbox, borra el resto', () => {
    expect(reconcileGuestEnrollments(['a', 'b'], ['p'], ['a', 'p', 'viejo'])).toEqual({
      add: ['b'],
      remove: ['viejo'],
    });
  });

  it('lista del server vacia borra todo menos lo pendiente', () => {
    expect(reconcileGuestEnrollments([], ['p'], ['x', 'p'])).toEqual({ add: [], remove: ['x'] });
  });
});
