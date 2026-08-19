import type { components } from '@securepass/contracts';

import type { SessionUser } from '@/modules/auth/types';

export function hasRole(user: SessionUser, role: string): boolean {
  return user.roles.includes(role);
}

export function isResident(user: SessionUser): boolean {
  return user.roles.some(
    (role) => role === 'RESIDENT_OWNER' || role === 'RESIDENT_MEMBER',
  );
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
