import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncAccessCache } from '@/modules/offline/access-cache';

// Base en memoria que registra signing_keys_cache y revoked_cache.
// withTransactionSync marca que las escrituras pasaron dentro de una.
const db = vi.hoisted(() => {
  const state = {
    keys: new Map<string, string>(),
    revoked: new Map<string, string | null>(),
    inTransaction: false,
    writesOutsideTx: 0,
  };
  return {
    state,
    runSync: (sql: string, params: (string | null)[] = []) => {
      if (!state.inTransaction) state.writesOutsideTx++;
      const [first, second, third] = params;
      if (sql.includes('revoked_cache')) {
        // Upsert: inserta o completa un revoked_at NULL; si no, no cambia nada.
        if (!first) return { changes: 0 };
        const current = state.revoked.get(first);
        if (current === undefined) {
          state.revoked.set(first, third ?? null);
          return { changes: 1 };
        }
        if (current === null && third) {
          state.revoked.set(first, third);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.startsWith('DELETE')) state.keys.clear();
      else if (first && second) state.keys.set(first, second);
      return { changes: 1 };
    },
    withTransactionSync: (fn: () => void) => {
      state.inTransaction = true;
      try {
        fn();
      } finally {
        state.inTransaction = false;
      }
    },
    getFirstSync: () => {
      const known = [...state.revoked.values()].filter((v) => v !== null).sort();
      return { revoked_at: known.at(-1) ?? null };
    },
  };
});

// Server de revocaciones como el backend: revoked_at > since, ascendente,
// cortado en `limit`. Registra cada since pedido.
const revokedServer = vi.hoisted(() => ({
  rows: [] as { jti: string; revokedAt: string }[],
  limit: 1000,
  requested: [] as string[],
  failing: false,
  respond(since: string) {
    this.requested.push(since);
    if (this.failing) return Promise.resolve({ error: { status: 500 } });
    const data = this.rows
      .filter((row) => Date.parse(row.revokedAt) > Date.parse(since))
      .sort((a, b) => Date.parse(a.revokedAt) - Date.parse(b.revokedAt))
      .slice(0, this.limit);
    return Promise.resolve({ data });
  },
}));

const keysResponse = vi.hoisted(() => ({
  current: (): Promise<unknown> => Promise.resolve({}),
}));

vi.mock('@/common/db/database', () => ({ getDb: () => db }));
vi.mock('@/common/api/client', () => ({
  authRequest: (request: () => Promise<unknown>) => request(),
  api: {
    GET: (path: string, init?: { params: { query: { since: string } } }) =>
      path === '/api/v1/access/keys'
        ? keysResponse.current()
        : revokedServer.respond(init?.params.query.since ?? ''),
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
  db.state.revoked = new Map();
  db.state.writesOutsideTx = 0;
  revokedServer.rows = [];
  revokedServer.limit = 1000;
  revokedServer.requested = [];
  revokedServer.failing = false;
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

function revocation(jti: string, revokedAt: string) {
  return { jti, revokedAt };
}

describe('syncAccessCache - revocaciones (#166)', () => {
  it('trae mas revocaciones que el corte del server, pagina por pagina', async () => {
    revokedServer.limit = 3;
    revokedServer.rows = Array.from({ length: 7 }, (_, i) =>
      revocation(`jti-${i}`, `2026-09-30T10:00:0${i}.000Z`),
    );
    await syncAccessCache();
    expect([...db.state.revoked.keys()].sort()).toEqual(revokedServer.rows.map((r) => r.jti));
    expect(db.state.writesOutsideTx).toBe(0);
  });

  it('pide desde el mayor revokedAt guardado, no desde la hora del telefono', async () => {
    db.state.revoked = new Map([['vieja', '2026-09-30T10:00:00.000Z']]);
    revokedServer.rows = [revocation('nueva', '2026-09-30T10:00:05.000Z')];
    await syncAccessCache();
    expect(revokedServer.requested[0]).toBe('2026-09-30T09:59:59.999Z');
    expect(db.state.revoked.has('nueva')).toBe(true);
  });

  it('un corte de pagina en medio de un empate no pierde la fila empatada', async () => {
    revokedServer.limit = 2;
    revokedServer.rows = [
      revocation('a', '2026-09-30T10:00:00.000Z'),
      revocation('b', '2026-09-30T10:00:01.000Z'),
      revocation('c', '2026-09-30T10:00:01.000Z'),
    ];
    await syncAccessCache();
    expect([...db.state.revoked.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('completa el revoked_at de las filas anteriores a la migracion', async () => {
    db.state.revoked = new Map([['legacy', null]]);
    revokedServer.rows = [revocation('legacy', '2026-09-30T10:00:00.000Z')];
    await syncAccessCache();
    expect(revokedServer.requested[0]).toBe(new Date(0).toISOString());
    expect(db.state.revoked.get('legacy')).toBe('2026-09-30T10:00:00.000Z');
  });

  it('con un empate mas grande que la pagina, corta en vez de quedar en loop', async () => {
    revokedServer.limit = 2;
    revokedServer.rows = ['a', 'b', 'c'].map((jti) =>
      revocation(jti, '2026-09-30T10:00:00.000Z'),
    );
    await syncAccessCache();
    expect(revokedServer.requested.length).toBeLessThan(5);
  });

  it('error del server: no toca el cache', async () => {
    db.state.revoked = new Map([['vieja', '2026-09-30T10:00:00.000Z']]);
    revokedServer.failing = true;
    await syncAccessCache();
    expect([...db.state.revoked.keys()]).toEqual(['vieja']);
  });
});
