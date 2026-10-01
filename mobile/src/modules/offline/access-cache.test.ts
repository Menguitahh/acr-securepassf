import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncAccessCache } from '@/modules/offline/access-cache';

// Base en memoria que registra solo lo que toca signing_keys_cache.
// withTransactionSync marca que las escrituras pasaron dentro de una.
const db = vi.hoisted(() => {
  const state = {
    keys: new Map<string, string>(),
    inTransaction: false,
    writesOutsideTx: 0,
  };
  return {
    state,
    runSync: (sql: string, params: string[] = []) => {
      if (!sql.includes('signing_keys_cache')) return;
      if (!state.inTransaction) state.writesOutsideTx++;
      if (sql.startsWith('DELETE')) state.keys.clear();
      else if (params[0] && params[1]) state.keys.set(params[0], params[1]);
    },
    withTransactionSync: (fn: () => void) => {
      state.inTransaction = true;
      try {
        fn();
      } finally {
        state.inTransaction = false;
      }
    },
    getFirstSync: () => null,
  };
});

const keysResponse = vi.hoisted(() => ({
  current: (): Promise<unknown> => Promise.resolve({}),
}));

vi.mock('@/common/db/database', () => ({ getDb: () => db }));
vi.mock('@/common/api/client', () => ({
  authRequest: (request: () => Promise<unknown>) => request(),
  api: {
    GET: (path: string) =>
      path === '/api/v1/access/keys'
        ? keysResponse.current()
        : Promise.resolve({ data: [] }),
  },
}));

function respondKeys(response: unknown) {
  keysResponse.current = () => Promise.resolve(response);
}

beforeEach(() => {
  db.state.keys = new Map([
    ['kid-b', 'clave-del-barrio-b'],
    ['kid-a-vieja', 'clave-desactivada'],
  ]);
  db.state.writesOutsideTx = 0;
});

describe('syncAccessCache - claves', () => {
  it('un sync exitoso deja exactamente las claves de la respuesta, en una transaccion', async () => {
    respondKeys({ data: [{ kid: 'kid-a', publicKey: 'clave-a' }] });
    await syncAccessCache();
    expect(Object.fromEntries(db.state.keys)).toEqual({ 'kid-a': 'clave-a' });
    expect(db.state.writesOutsideTx).toBe(0);
  });

  it('descarta entradas sin kid o sin clave y reemplaza con las validas', async () => {
    respondKeys({
      data: [
        { kid: 'kid-a', publicKey: 'clave-a' },
        { kid: 'sin-clave' },
        { publicKey: 'sin-kid' },
      ],
    });
    await syncAccessCache();
    expect(Object.fromEntries(db.state.keys)).toEqual({ 'kid-a': 'clave-a' });
  });

  it.each([
    ['error del server', { error: { status: 500 } }],
    ['respuesta sin claves', { data: [] }],
    ['respuesta sin claves usables', { data: [{ kid: 'sin-clave' }] }],
  ])('%s: el cache anterior queda intacto', async (_, response) => {
    respondKeys(response);
    await syncAccessCache();
    expect([...db.state.keys.keys()]).toEqual(['kid-b', 'kid-a-vieja']);
  });

  it('sin red: el cache anterior queda intacto', async () => {
    keysResponse.current = () =>
      Promise.reject(new TypeError('Network request failed'));
    await syncAccessCache();
    expect([...db.state.keys.keys()]).toEqual(['kid-b', 'kid-a-vieja']);
  });
});
