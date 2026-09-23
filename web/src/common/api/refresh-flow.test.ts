import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/modules/auth/data";
import type { SessionUser } from "@/modules/auth/types";
import { memoryStorage } from "@/test/memory-storage";

const OVERVIEW = "/api/v1/admin/metrics/overview";
const admin: SessionUser = { id: "u1", fullName: "Ana Admin", neighborhoodId: "n1", roles: ["ADMIN"] };

type Handler = (request: Request) => Promise<Response>;

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const refreshed = () => json(200, { accessToken: "A1", refreshToken: "R1", expiresIn: 900 });

function isRefresh(request: Request): boolean {
  return new URL(request.url).pathname === "/api/v1/auth/refresh";
}

// Stub de fetch ANTES de importar: openapi-fetch captura globalThis.fetch
// al crear el client. resetModules da un inFlight y un store limpios.
async function setup(handler: Handler) {
  vi.resetModules();
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);

  const storage = await import("@/modules/auth/session-storage");
  storage.saveSession({ accessToken: "A0", refreshToken: "R0" }, admin);
  const { useSessionStore } = await import("@/modules/auth/session-store");
  useSessionStore.getState().signIn(admin);
  const client = await import("@/common/api/client");

  const refreshCalls = () => fetchMock.mock.calls.filter(([request]) => isRefresh(request)).length;
  const bearers = () =>
    fetchMock.mock.calls
      .filter(([request]) => !isRefresh(request))
      .map(([request]) => request.headers.get("Authorization"));
  return { ...client, useSessionStore, refreshCalls, bearers };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("refresh flow", () => {
  it("dos 401 en paralelo disparan un solo refresh y ambos reintentan con el access nuevo", async () => {
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
      if (request.headers.get("Authorization") === "Bearer A1") return json(200);
      rejected += 1;
      if (rejected === 2) bothRejected();
      return json(401);
    });

    const [a, b] = await Promise.all([api.GET(OVERVIEW), api.GET(OVERVIEW)]);

    expect(refreshCalls()).toBe(1);
    expect(a.response.status).toBe(200);
    expect(b.response.status).toBe(200);
    expect(bearers()).toEqual(["Bearer A0", "Bearer A0", "Bearer A1", "Bearer A1"]);
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("A1");
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe("R1");
  });

  it("un 401 que llega despues de que el refresh termino no dispara otro refresh", async () => {
    let first: Promise<unknown> = Promise.resolve();
    let a0Calls = 0;

    const { api, refreshCalls, bearers } = await setup(async (request) => {
      if (isRefresh(request)) return refreshed();
      if (request.headers.get("Authorization") === "Bearer A1") return json(200);
      a0Calls += 1;
      // El segundo request salio con A0 pero su 401 llega tarde, cuando el
      // primero ya refresco y reintento.
      if (a0Calls === 2) await first;
      return json(401);
    });

    first = api.GET(OVERVIEW);
    const late = api.GET(OVERVIEW);
    await first;
    const lateResult = await late;

    expect(refreshCalls()).toBe(1);
    expect(lateResult.response.status).toBe(200);
    expect(bearers().filter((bearer) => bearer === "Bearer A1")).toHaveLength(2);
  });

  it("refresh rechazado por el server cierra la sesion con motivo expired", async () => {
    const { api, useSessionStore, SessionEndedError } = await setup(async () => json(401));

    await expect(api.GET(OVERVIEW)).rejects.toBeInstanceOf(SessionEndedError);
    expect(useSessionStore.getState().session).toEqual({ status: "signedOut", reason: "expired" });
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it("refresh que falla por red no toca la sesion", async () => {
    const { api, useSessionStore } = await setup(async (request) => {
      if (isRefresh(request)) throw new TypeError("Failed to fetch");
      return json(401);
    });

    await expect(api.GET(OVERVIEW)).rejects.toThrow("Failed to fetch");
    expect(useSessionStore.getState().session.status).toBe("signedIn");
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("A0");
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe("R0");
  });

  it("refresh con 5xx no toca la sesion", async () => {
    const { api, useSessionStore } = await setup(async (request) =>
      isRefresh(request) ? json(503) : json(401),
    );

    await expect(api.GET(OVERVIEW)).rejects.toThrow();
    expect(useSessionStore.getState().session.status).toBe("signedIn");
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe("R0");
  });

  it("si el reintento vuelve a dar 401 cierra la sesion, sin loop", async () => {
    const { api, refreshCalls, useSessionStore, SessionEndedError } = await setup(async (request) =>
      isRefresh(request) ? refreshed() : json(401),
    );

    await expect(api.GET(OVERVIEW)).rejects.toBeInstanceOf(SessionEndedError);
    expect(refreshCalls()).toBe(1);
    expect(useSessionStore.getState().session).toEqual({ status: "signedOut", reason: "expired" });
  });
});
