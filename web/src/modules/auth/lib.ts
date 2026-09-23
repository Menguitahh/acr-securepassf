import type { components } from "@securepass/contracts";

import { ADMIN_ROLE, LOGIN_ERRORS } from "@/modules/auth/data";
import type { SessionUser } from "@/modules/auth/types";

export function isAdmin(user: SessionUser): boolean {
  return user.roles.includes(ADMIN_ROLE);
}

export function toSessionUser(
  payload: components["schemas"]["UserPayload"],
): SessionUser | null {
  if (!payload.id || !payload.fullName || !payload.neighborhoodId) return null;
  if (!payload.roles) return null;
  return {
    id: payload.id,
    fullName: payload.fullName,
    neighborhoodId: payload.neighborhoodId,
    roles: payload.roles,
  };
}

export function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) return false;
  if (!("id" in value) || typeof value.id !== "string") return false;
  if (!("fullName" in value) || typeof value.fullName !== "string") return false;
  if (!("neighborhoodId" in value) || typeof value.neighborhoodId !== "string") return false;
  if (!("roles" in value) || !Array.isArray(value.roles)) return false;
  return value.roles.every((role) => typeof role === "string");
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
