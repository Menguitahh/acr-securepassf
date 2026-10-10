import { describe, expect, it } from "vitest";

import { LOGIN_ERRORS } from "@/modules/auth/data";
import { canUseDashboard, isSessionUser, loginErrorMessage, parseViewing, retryAfterMinutes, toSessionUser } from "@/modules/auth/lib";

describe("loginErrorMessage", () => {
  it("401 es credenciales incorrectas", () => {
    expect(loginErrorMessage(401, null)).toBe(LOGIN_ERRORS.invalidCredentials);
  });

  it("429 usa Retry-After en minutos, redondeando para arriba", () => {
    expect(loginErrorMessage(429, "900")).toBe("Demasiados intentos. Probá de nuevo en 15 minutos.");
    expect(loginErrorMessage(429, "30")).toBe("Demasiados intentos. Probá de nuevo en 1 minuto.");
  });

  it("429 sin Retry-After valido no inventa un numero", () => {
    expect(loginErrorMessage(429, null)).toBe("Demasiados intentos. Esperá unos minutos y probá de nuevo.");
    expect(retryAfterMinutes("mañana")).toBeNull();
  });

  it("5xx es error del servidor", () => {
    expect(loginErrorMessage(503, null)).toBe(LOGIN_ERRORS.server);
  });
});

describe("toSessionUser / canUseDashboard", () => {
  it("rechaza payloads incompletos", () => {
    expect(toSessionUser({ id: "u1", fullName: "Ana", neighborhoodTimezone: "America/Argentina/Mendoza" })).toBeNull();
  });

  it("rechaza una timezone que Intl no conoce", () => {
    expect(
      toSessionUser({ id: "u1", fullName: "Ana", neighborhoodId: "n1", neighborhoodTimezone: "Marte/Olympus", roles: ["ADMIN"] }),
    ).toBeNull();
  });

  it("detecta ADMIN entre varios roles", () => {
    const user = toSessionUser({
      id: "u1",
      fullName: "Ana",
      neighborhoodId: "n1",
      neighborhoodTimezone: "America/Argentina/Mendoza",
      roles: ["RESIDENT_OWNER", "ADMIN"],
    });
    expect(user && canUseDashboard(user)).toBe(true);
    expect(canUseDashboard({ kind: "admin", id: "u1", fullName: "Ana", neighborhoodId: "n1", neighborhoodTimezone: "America/Argentina/Mendoza", roles: ["RESIDENT_OWNER"] })).toBe(false);
  });
});

describe("duenio de la plataforma (#229)", () => {
  it("entra sin barrio propio y puede usar el dashboard", () => {
    const user = toSessionUser({ id: "p1", fullName: "Duenio", neighborhoodTimezone: "", roles: ["PLATFORM_ADMIN"] });
    expect(user).toEqual({ kind: "platform", id: "p1", fullName: "Duenio", roles: ["PLATFORM_ADMIN"] });
    expect(user && canUseDashboard(user)).toBe(true);
    expect(user && isSessionUser(user)).toBe(true);
  });

  it("la plataforma gana aunque ademas administre un barrio", () => {
    const user = toSessionUser({
      id: "p1",
      fullName: "Duenio",
      neighborhoodId: "n1",
      neighborhoodTimezone: "America/Argentina/Mendoza",
      roles: ["ADMIN", "PLATFORM_ADMIN"],
    });
    expect(user?.kind).toBe("platform");
  });

  it("una sesion guardada sin kind no valida", () => {
    expect(
      isSessionUser({ id: "u1", fullName: "Ana", neighborhoodId: "n1", neighborhoodTimezone: "America/Argentina/Mendoza", roles: ["ADMIN"] }),
    ).toBe(false);
  });

  it("el barrio que se mira se valida al leerlo", () => {
    expect(parseViewing({ id: "n1", name: "Los Robles", timeZone: "America/Argentina/Mendoza" })).toEqual({
      id: "n1",
      name: "Los Robles",
      timeZone: "America/Argentina/Mendoza",
    });
    expect(parseViewing({ id: "n1", name: "Los Robles", timeZone: "Marte/Olympus" })).toBeNull();
    expect(parseViewing("x")).toBeNull();
  });
});
