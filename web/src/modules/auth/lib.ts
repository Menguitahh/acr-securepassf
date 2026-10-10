import type { components } from "@securepass/contracts";

import { isValidTimeZone } from "@/common/lib/datetime";
import { ADMIN_ROLE, LOGIN_ERRORS, PLATFORM_ROLE } from "@/modules/auth/data";
import type { SessionUser, Viewing } from "@/modules/auth/types";

// El dashboard es para el admin de un barrio y para el duenio de la
// plataforma (#229). Residentes y guardias usan la app.
export function canUseDashboard(user: SessionUser): boolean {
  return user.kind === "platform" || user.roles.includes(ADMIN_ROLE);
}

export function toSessionUser(
  payload: components["schemas"]["UserPayload"],
): SessionUser | null {
  if (!payload.id || !payload.fullName || !payload.roles) return null;
  // El duenio de la plataforma no tiene barrio propio: entra al panel aunque
  // ademas administre uno.
  if (payload.roles.includes(PLATFORM_ROLE)) {
    return { kind: "platform", id: payload.id, fullName: payload.fullName, roles: payload.roles };
  }
  if (!payload.neighborhoodId) return null;
  if (!isValidTimeZone(payload.neighborhoodTimezone)) return null;
  return {
    kind: "admin",
    id: payload.id,
    fullName: payload.fullName,
    neighborhoodId: payload.neighborhoodId,
    neighborhoodTimezone: payload.neighborhoodTimezone,
    roles: payload.roles,
  };
}

function text(value: object, key: string): string | null {
  const field: unknown = Reflect.get(value, key);
  return typeof field === "string" ? field : null;
}

export function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) return false;
  if (!text(value, "id") || !text(value, "fullName")) return false;
  const roles: unknown = Reflect.get(value, "roles");
  if (!Array.isArray(roles) || !roles.every((role) => typeof role === "string")) return false;
  const kind = text(value, "kind");
  if (kind === "platform") return true;
  // Sesiones guardadas antes de kind o de neighborhoodTimezone no validan:
  // login de nuevo.
  if (kind !== "admin" || !text(value, "neighborhoodId")) return false;
  const timeZone = text(value, "neighborhoodTimezone");
  return timeZone !== null && isValidTimeZone(timeZone);
}

export function parseViewing(value: unknown): Viewing | null {
  if (typeof value !== "object" || value === null) return null;
  const id = text(value, "id");
  const name = text(value, "name");
  const timeZone = text(value, "timeZone");
  if (!id || !name || !timeZone || !isValidTimeZone(timeZone)) return null;
  return { id, name, timeZone };
}

// 429 del login: Retry-After viene en segundos. Se redondea para arriba
// para no decir "0 minutos" con 30 s de bloqueo restantes.
export function retryAfterMinutes(header: string | null): number | null {
  const seconds = Number(header);
  if (!header || !Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds / 60);
}

export function tooManyAttemptsMessage(minutes: number | null): string {
  if (minutes === null) return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
  const unit = minutes === 1 ? "minuto" : "minutos";
  return `Demasiados intentos. Probá de nuevo en ${minutes} ${unit}.`;
}

export function loginErrorMessage(status: number, retryAfter: string | null): string {
  if (status === 400 || status === 401) return LOGIN_ERRORS.invalidCredentials;
  if (status === 429) return tooManyAttemptsMessage(retryAfterMinutes(retryAfter));
  if (status >= 500) return LOGIN_ERRORS.server;
  return LOGIN_ERRORS.incompleteSession;
}
