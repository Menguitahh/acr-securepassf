import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncWorkerCache } from '@/modules/offline/worker-cache';

// Base en memoria que registra las dos tablas del padron.
// withTransactionSync marca que las escrituras pasaron dentro de una.
const db = vi.hoisted(() => {
  const state = {
    permissions: new Set<string>(),
    enrolled: new Set<string>(),
    inTransaction: false,
    writesOutsideTx: 0,
  };
  return {
    state,
    runSync: (sql: string, params: (string | null)[] = []) => {
      if (!state.inTransaction) state.writesOutsideTx++;
      const table = sql.includes('worker_permissions_cache') ? state.permissions : state.enrolled;
      if (sql.startsWith('DELETE')) table.clear();
      else table.add(`${params[0]}|${params[3] ?? ''}`.replace(/\|$/, ''));
    },
    withTransactionSync: (fn: () => void) => {
      state.inTransaction = true;
      try {
        fn();
      } finally {
        state.inTransaction = false;
      }
    },
  };
});

const response = vi.hoisted(() => ({
  current: (): Promise<unknown> => Promise.resolve({}),
}));

vi.mock('@/common/db/database', () => ({ getDb: () => db }));
vi.mock('@/common/api/client', () => ({
  authRequest: (request: () => Promise<unknown>) => request(),
  api: { GET: () => response.current() },
}));

const permission = {
  userId: 'u-nuevo',
  jti: 'j1',
  lotId: 'l1',
  lotCode: 'M4-L12',
  weekdays: [2],
  dailyFrom: '08:00',
  dailyUntil: '12:00',
  timezone: 'America/Argentina/Mendoza',
};

function respond(value: unknown) {
  response.current = () => Promise.resolve(value);
}

beforeEach(() => {
  db.state.permissions = new Set(['u-viejo|M1-L01']);
  db.state.enrolled = new Set(['u-viejo']);
  db.state.writesOutsideTx = 0;
});

describe('syncWorkerCache', () => {
  it('un sync exitoso deja exactamente el padron de la respuesta, en una transaccion', async () => {
    respond({ data: { permissions: [permission], enrolledUserIds: ['u-nuevo'] } });
    await syncWorkerCache();
    expect([...db.state.permissions]).toEqual(['u-nuevo|M4-L12']);
    expect([...db.state.enrolled]).toEqual(['u-nuevo']);
    expect(db.state.writesOutsideTx).toBe(0);
  });

  it('un padron vacio vacia el cache: conservar permisos dados de baja es fail-open', async () => {
    respond({ data: { permissions: [], enrolledUserIds: [] } });
    await syncWorkerCache();
    expect(db.state.permissions.size).toBe(0);
    expect(db.state.enrolled.size).toBe(0);
  });

  it.each([
    ['error del server', { error: { status: 500 } }],
    ['respuesta sin listas', { data: {} }],
    ['respuesta con el shape viejo (array)', { data: [permission] }],
  ])('%s: el cache anterior queda intacto', async (_, value) => {
    respond(value);
    await syncWorkerCache();
    expect([...db.state.permissions]).toEqual(['u-viejo|M1-L01']);
    expect([...db.state.enrolled]).toEqual(['u-viejo']);
  });

  it('sin red: el cache anterior queda intacto', async () => {
    response.current = () => Promise.reject(new TypeError('Network request failed'));
    await syncWorkerCache();
    expect([...db.state.permissions]).toEqual(['u-viejo|M1-L01']);
    expect([...db.state.enrolled]).toEqual(['u-viejo']);
  });
});
