import { beforeEach, describe, expect, it, vi } from "vitest";

import { REFRESH_TOKEN_KEY, USER_KEY } from "@/modules/auth/data";
import { clearSession, loadSession, saveSession } from "@/modules/auth/session-storage";
import type { SessionUser } from "@/modules/auth/types";
import { memoryStorage } from "@/test/memory-storage";

const user: SessionUser = {
  id: "u1",
  fullName: "Ana Admin",
  neighborhoodId: "n1",
  neighborhoodTimezone: "America/Argentina/Mendoza",
  roles: ["ADMIN"],
};
const tokens = { accessToken: "A0", refreshToken: "R0" };

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
});

describe("session storage", () => {
  it("saveSession -> loadSession rehidrata user y ambos tokens", () => {
    saveSession(tokens, user);
    expect(loadSession()).toEqual({ tokens, user });
  });

  it("guarda el refresh en sessionStorage, no en localStorage", () => {
    saveSession(tokens, user);
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe("R0");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it("sin refresh en sessionStorage devuelve null aunque haya access y user", () => {
    saveSession(tokens, user);
    vi.stubGlobal("sessionStorage", memoryStorage());
    expect(loadSession()).toBeNull();
  });

  it("user corrupto devuelve null sin tirar", () => {
    saveSession(tokens, user);
    localStorage.setItem(USER_KEY, "{no es json");
    expect(loadSession()).toBeNull();
    localStorage.setItem(USER_KEY, JSON.stringify({ id: "u1" }));
    expect(loadSession()).toBeNull();
  });

  it("sesion guardada antes de neighborhoodTimezone no valida", () => {
    saveSession(tokens, user);
    const legacy: Record<string, unknown> = { ...user };
    delete legacy.neighborhoodTimezone;
    localStorage.setItem(USER_KEY, JSON.stringify(legacy));
    expect(loadSession()).toBeNull();
  });

  it("storage inaccesible devuelve null sin tirar", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(loadSession()).toBeNull();
  });

  it("clearSession borra todo", () => {
    saveSession(tokens, user);
    clearSession();
    expect(loadSession()).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
