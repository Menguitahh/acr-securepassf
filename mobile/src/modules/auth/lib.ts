import type { components } from '@securepass/contracts';

import type { SessionUser } from '@/modules/auth/types';

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
  return hasRole(user, 'GUARD') || isResident(user);
}

export type HomeRoute = '/(guard)/scanner' | '/(resident)' | '/login';

export function homeRouteFor(user: SessionUser | null): HomeRoute {
  if (!user) return '/login';
  if (hasRole(user, 'GUARD')) return '/(guard)/scanner';
  if (isResident(user)) return '/(resident)';
  return '/login';
}

export function toSessionUser(
  payload: components['schemas']['UserPayload'],
): SessionUser | null {
  if (!payload.id || !payload.fullName || !payload.neighborhoodId) return null;
  if (!payload.roles || !payload.roles.every((role) => typeof role === 'string')) {
    return null;
  }
  return {
    id: payload.id,
    fullName: payload.fullName,
    neighborhoodId: payload.neighborhoodId,
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
  return true;
}
