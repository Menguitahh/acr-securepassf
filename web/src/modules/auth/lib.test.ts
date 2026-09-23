import { describe, expect, it } from "vitest";

import { LOGIN_ERRORS } from "@/modules/auth/data";
import { isAdmin, loginErrorMessage, retryAfterMinutes, toSessionUser } from "@/modules/auth/lib";

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

describe("toSessionUser / isAdmin", () => {
  it("rechaza payloads incompletos", () => {
    expect(toSessionUser({ id: "u1", fullName: "Ana", neighborhoodTimezone: "America/Argentina/Mendoza" })).toBeNull();
  });

  it("detecta ADMIN entre varios roles", () => {
    const user = toSessionUser({
      id: "u1",
      fullName: "Ana",
      neighborhoodId: "n1",
      neighborhoodTimezone: "America/Argentina/Mendoza",
      roles: ["RESIDENT_OWNER", "ADMIN"],
    });
    expect(user && isAdmin(user)).toBe(true);
    expect(isAdmin({ id: "u1", fullName: "Ana", neighborhoodId: "n1", roles: ["RESIDENT_OWNER"] })).toBe(false);
  });
});
