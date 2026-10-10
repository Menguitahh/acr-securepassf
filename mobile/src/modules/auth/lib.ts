import type { components } from '@securepass/contracts';

import type { SessionUser } from '@/modules/auth/types';

// US-53 (#212): el server responde 204 exista o no la cuenta. Solo el 429
// (limite por IP o por email) y las fallas cambian el mensaje.
export function forgotPasswordError(status: number): string | null {
  if (status === 204) return null;
  if (status === 429) return 'Pediste demasiados enlaces. Esperá unos minutos y volvé a intentar.';
  if (status === 400) return 'Email inválido. Revisá el formato.';
  return 'No se pudo enviar el enlace. Intentá de nuevo en unos minutos.';
}

export function hasRole(user: SessionUser, role: string): boolean {
  return user.roles.includes(role);
}

export function initials(fullName: string): string {
  return fullName
    .split(' ')
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

// Lotes donde el usuario vive (securepassb#216). lots[] tambien trae las
// casas donde trabaja (kind WORKER), para la app del trabajador; en las
// pantallas de residente esas darian 403 porque el JWT no las incluye.
export function residentLots(user: SessionUser): SessionUser['lots'] {
  return user.lots.filter((lot) => lot.kind !== 'WORKER');
}

export function isResident(user: SessionUser): boolean {
  return user.roles.some(
    (role) => role === 'RESIDENT_OWNER' || role === 'RESIDENT_MEMBER',
  );
}

// Roles con UI en la app mobile. Un usuario sin ninguno de estos roles
// (por ejemplo ADMIN, que solo usa el dashboard) no tiene pantalla de
// destino: mandarlo a /login es el unico estado terminal del flujo de
// redirects. Sin eso, index -> (resident) -> /login -> index cicla sin fin.
export function hasMobileRole(user: SessionUser): boolean {
  return hasRole(user, 'GUARD') || isResident(user) || isWorker(user);
}

// US-65: el trabajador no tiene rol de barrio; lo define tener al menos un
// lote donde trabaja.
export function isWorker(user: SessionUser): boolean {
  return user.lots.some((lot) => lot.kind === 'WORKER');
}

export type HomeRoute = '/(guard)/scanner' | '/(resident)' | '/(worker)/pass' | '/login';

export function homeRouteFor(user: SessionUser | null): HomeRoute {
  if (!user) return '/login';
  if (hasRole(user, 'GUARD')) return '/(guard)/scanner';
  if (isResident(user)) return '/(resident)';
  if (isWorker(user)) return '/(worker)/pass';
  return '/login';
}

// #229: cuentas sin pantalla en la app. El dueño de la plataforma no tiene
// barrio (toSessionUser lo rechaza), por eso se mira el payload crudo.
export function isWebOnlyAccount(payload: components['schemas']['UserPayload']): boolean {
  if (payload.roles?.includes('PLATFORM_ADMIN')) return true;
  const user = toSessionUser(payload);
  return user !== null && !hasMobileRole(user);
}

export function toSessionUser(
  payload: components['schemas']['UserPayload'],
): SessionUser | null {
  if (!payload.id || !payload.fullName || !payload.neighborhoodId) return null;
  if (!payload.roles || !payload.roles.every((role) => typeof role === 'string')) {
    return null;
  }
  const tz =
    typeof payload.neighborhoodTimezone === 'string' && payload.neighborhoodTimezone.length > 0
      ? payload.neighborhoodTimezone
      : null;
  return {
    id: payload.id,
    fullName: payload.fullName,
    neighborhoodId: payload.neighborhoodId,
    neighborhoodTimezone: tz,
    roles: payload.roles,
    lots: payload.lots ?? [],
  };
}

export function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || typeof value.id !== 'string') return false;
  if (!('fullName' in value) || typeof value.fullName !== 'string') return false;
  if (!('neighborhoodId' in value) || typeof value.neighborhoodId !== 'string') {
    return false;
  }
  if (!('roles' in value) || !Array.isArray(value.roles)) return false;
  if (!value.roles.every((role) => typeof role === 'string')) return false;
  if (!('lots' in value) || !Array.isArray(value.lots)) return false;
  // Tolerante con sesiones persistidas antes de securepassb#155: el campo
  // puede faltar. Si viene, tiene que ser string o null; cualquier otro
  // tipo indica corrupcion y se rechaza para forzar re-login.
  if ('neighborhoodTimezone' in value) {
    const tz = (value as { neighborhoodTimezone: unknown }).neighborhoodTimezone;
    if (tz !== null && typeof tz !== 'string') return false;
  }
  return true;
}
