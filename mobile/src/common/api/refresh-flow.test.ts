import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from '@/modules/auth/types';

// SecureStore y AsyncStorage en memoria: el setup global devuelve null
// siempre, y aca hace falta leer lo que el refresh escribio.
const store = vi.hoisted(() => new Map<string, string>());
const wipeLocalDatabase = vi.hoisted(() => vi.fn());

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => store.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    store.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    store.delete(key);
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
  },
}));

// El outbox es de la garita (#122): cortar la sesion no puede borrarlo.
vi.mock('@/common/db/database', () => ({ wipeLocalDatabase }));

const ACCESS = 'securepass.access-token';
const REFRESH = 'securepass.refresh-token';
const STAYS = '/api/v1/stays/open';

const guard: SessionUser = {
  id: 'u1',
  fullName: 'Gustavo Guardia',
  neighborhoodId: 'n1',
  neighborhoodTimezone: 'America/Argentina/Mendoza',
  roles: ['GUARD'],
  lots: [],
};

type Handler = (request: Request) => Promise<Response>;

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const refreshed = () => json(200, { accessToken: 'A1', refreshToken: 'R1', expiresIn: 900 });

function isRefresh(request: Request): boolean {
  return new URL(request.url).pathname === '/api/v1/auth/refresh';
}

// Stub de fetch ANTES de importar: openapi-fetch captura globalThis.fetch
// al crear el client. resetModules da un inFlight y un store limpios.
async function setup(handler: Handler) {
  vi.resetModules();
  store.clear();
  wipeLocalDatabase.mockClear();
  const fetchMock = vi.fn(handler);
  vi.stubGlobal('fetch', fetchMock);

  const storage = await import('@/modules/auth/session-storage');
  await storage.saveSession({ accessToken: 'A0', refreshToken: 'R0' }, guard);
  const { useSessionStore } = await import('@/modules/auth/session-store');
  useSessionStore.getState().signIn(guard);
  const client = await import('@/common/api/client');

  const refreshCalls = () => fetchMock.mock.calls.filter(([request]) => isRefresh(request)).length;
  const bearers = () =>
    fetchMock.mock.calls
      .filter(([request]) => !isRefresh(request))
      .map(([request]) => request.headers.get('Authorization'));
  return { ...client, useSessionStore, refreshCalls, bearers };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('refresh flow', () => {
  it('dos 401 en paralelo disparan un solo refresh y ambos reintentan con el access nuevo', async () => {
    let rejected = 0;
    let bothRejected: () => void = () => {};
    const bothRejectedP = new Promise<void>((resolve) => {
      bothRejected = resolve;
    });

    const { api, refreshCalls, bearers } = await setup(async (request) => {
      if (isRefresh(request)) {
        // El refresh no responde hasta que los dos requests vieron su 401:
        // garantiza que el segundo llega con el refresh todavia en vuelo.
        await bothRejectedP;
        return refreshed();
      }
      if (request.headers.get('Authorization') === 'Bearer A1') return json(200, { items: [] });
      rejected += 1;
      if (rejected === 2) bothRejected();
      return json(401);
    });

    const [a, b] = await Promise.all([api.GET(STAYS), api.GET(STAYS)]);

    expect(refreshCalls()).toBe(1);
    expect(a.response.status).toBe(200);
    expect(b.response.status).toBe(200);
    expect(bearers()).toEqual(['Bearer A0', 'Bearer A0', 'Bearer A1', 'Bearer A1']);
    expect(store.get(ACCESS)).toBe('A1');
    expect(store.get(REFRESH)).toBe('R1');
  });

  it('un 401 que llega despues de que el refresh termino no dispara otro refresh', async () => {
    let first: Promise<unknown> = Promise.resolve();
    let a0Calls = 0;

    const { api, refreshCalls, bearers } = await setup(async (request) => {
      if (isRefresh(request)) return refreshed();
      if (request.headers.get('Authorization') === 'Bearer A1') return json(200, { items: [] });
      a0Calls += 1;
      // El segundo request salio con A0 pero su 401 llega tarde, cuando el
      // primero ya refresco y reintento.
      if (a0Calls === 2) await first;
      return json(401);
    });

    first = api.GET(STAYS);
    const late = api.GET(STAYS);
    await first;
    const lateResult = await late;

    expect(refreshCalls()).toBe(1);
    expect(lateResult.response.status).toBe(200);
    expect(bearers().filter((bearer) => bearer === 'Bearer A1')).toHaveLength(2);
  });

  it('refresh rechazado limpia storage y pone el store en signedOut con motivo expired', async () => {
    const { api, useSessionStore, SessionExpiredError } = await setup(async () => json(401));

    await expect(api.GET(STAYS)).rejects.toBeInstanceOf(SessionExpiredError);
    const state = useSessionStore.getState();
    expect(state.status).toBe('signedOut');
    expect(state.user).toBeNull();
    expect(state.signOutReason).toBe('expired');
    expect(store.get(ACCESS)).toBeUndefined();
    expect(store.get(REFRESH)).toBeUndefined();
  });

  it('refresh que falla por red no toca la sesion', async () => {
    const { api, useSessionStore } = await setup(async (request) => {
      if (isRefresh(request)) throw new TypeError('Network request failed');
      return json(401);
    });

    await expect(api.GET(STAYS)).rejects.toThrow('Network request failed');
    expect(useSessionStore.getState().status).toBe('signedIn');
    expect(store.get(ACCESS)).toBe('A0');
    expect(store.get(REFRESH)).toBe('R0');
  });

  it('refresh con 5xx no desloguea: el refresh sigue siendo valido', async () => {
    const { api, useSessionStore } = await setup(async (request) =>
      isRefresh(request) ? json(503) : json(401),
    );

    await expect(api.GET(STAYS)).rejects.toThrow();
    expect(useSessionStore.getState().status).toBe('signedIn');
    expect(store.get(REFRESH)).toBe('R0');
  });

  it('si el reintento vuelve a dar 401 cierra la sesion, sin loop', async () => {
    const { api, refreshCalls, useSessionStore, SessionExpiredError } = await setup(async (request) =>
      isRefresh(request) ? refreshed() : json(401),
    );

    await expect(api.GET(STAYS)).rejects.toBeInstanceOf(SessionExpiredError);
    expect(refreshCalls()).toBe(1);
    expect(useSessionStore.getState().status).toBe('signedOut');
  });

  it('cortar la sesion no borra la base local (outbox de la garita)', async () => {
    const { api } = await setup(async () => json(401));

    await expect(api.GET(STAYS)).rejects.toThrow();
    expect(wipeLocalDatabase).not.toHaveBeenCalled();
  });

  it('login no manda Bearer ni refresca ante un 401', async () => {
    const { api, refreshCalls, bearers } = await setup(async () => json(401));

    const result = await api.POST('/api/v1/auth/login', { body: { identifier: 'g@x', password: 'mal' } });

    expect(result.response.status).toBe(401);
    expect(refreshCalls()).toBe(0);
    expect(bearers()).toEqual([null]);
  });
});
