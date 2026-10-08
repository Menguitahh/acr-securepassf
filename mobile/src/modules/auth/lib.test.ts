import { describe, expect, it } from 'vitest';

import {
  hasMobileRole,
  hasRole,
  homeRouteFor,
  initials,
  isResident,
  isSessionUser,
  residentLots,
  toSessionUser,
} from '@/modules/auth/lib';
import type { SessionUser } from '@/modules/auth/types';

const baseUser: SessionUser = {
  id: 'u1',
  fullName: 'Juan Perez',
  neighborhoodId: 'n1',
  neighborhoodTimezone: 'America/Argentina/Mendoza',
  roles: ['RESIDENT_OWNER'],
  lots: [],
};

describe('hasRole', () => {
  it('devuelve true si el usuario tiene el rol', () => {
    expect(hasRole({ ...baseUser, roles: ['GUARD', 'ADMIN'] }, 'GUARD')).toBe(true);
  });

  it('devuelve false si el usuario no tiene el rol', () => {
    expect(hasRole(baseUser, 'GUARD')).toBe(false);
  });
});

describe('isResident', () => {
  it('acepta RESIDENT_OWNER', () => {
    expect(isResident({ ...baseUser, roles: ['RESIDENT_OWNER'] })).toBe(true);
  });

  it('acepta RESIDENT_MEMBER', () => {
    expect(isResident({ ...baseUser, roles: ['RESIDENT_MEMBER'] })).toBe(true);
  });

  it('rechaza guardias y admins', () => {
    expect(isResident({ ...baseUser, roles: ['GUARD'] })).toBe(false);
    expect(isResident({ ...baseUser, roles: ['ADMIN'] })).toBe(false);
  });
});

describe('hasMobileRole', () => {
  it('acepta guardias y residentes', () => {
    expect(hasMobileRole({ ...baseUser, roles: ['GUARD'] })).toBe(true);
    expect(hasMobileRole(baseUser)).toBe(true);
  });

  it('rechaza admins y roles vacios', () => {
    expect(hasMobileRole({ ...baseUser, roles: ['ADMIN'] })).toBe(false);
    expect(hasMobileRole({ ...baseUser, roles: [] })).toBe(false);
  });
});

describe('homeRouteFor', () => {
  it('manda al guardia al scanner', () => {
    expect(homeRouteFor({ ...baseUser, roles: ['GUARD'] })).toBe('/(guard)/scanner');
  });

  it('manda al residente a su home', () => {
    expect(homeRouteFor(baseUser)).toBe('/(resident)');
  });

  it('manda al login a la sesion sin rol mobile para cortar el ciclo de redirects', () => {
    expect(homeRouteFor({ ...baseUser, roles: ['ADMIN'] })).toBe('/login');
  });

  it('manda al login cuando no hay sesion', () => {
    expect(homeRouteFor(null)).toBe('/login');
  });
});

describe('initials', () => {
  it('toma las iniciales de las dos primeras palabras', () => {
    expect(initials('Juan Perez')).toBe('JP');
    expect(initials('Maria del Carmen')).toBe('MD');
    expect(initials('  juan  perez ')).toBe('JP');
  });

  it('una sola palabra devuelve una inicial', () => {
    expect(initials('Guardia')).toBe('G');
  });
});

describe('toSessionUser', () => {
  it('convierte un payload completo', () => {
    const user = toSessionUser({
      id: 'u1',
      fullName: 'Juan Perez',
      neighborhoodId: 'n1',
      neighborhoodTimezone: 'America/Argentina/Mendoza',
      roles: ['GUARD'],
      lots: [{ id: 'l1', code: 'M4-L12', canInvite: true, isOwner: true, kind: 'OWNER' }],
    });
    expect(user).toEqual({
      id: 'u1',
      fullName: 'Juan Perez',
      neighborhoodId: 'n1',
      neighborhoodTimezone: 'America/Argentina/Mendoza',
      roles: ['GUARD'],
      lots: [{ id: 'l1', code: 'M4-L12', canInvite: true, isOwner: true, kind: 'OWNER' }],
    });
  });

  it('acepta payloads sin neighborhoodTimezone (backend viejo o sesion pre-#155)', () => {
    // El contrato OpenAPI ahora marca neighborhoodTimezone como requerido,
    // pero el guard tiene que seguir siendo tolerante en runtime por si el
    // backend regresiona o una sesion vieja se procesa. @ts-expect-error
    // documenta la violacion intencional del contrato para este test.
    // @ts-expect-error tolerancia runtime a payload sin tz
    const user = toSessionUser({
      id: 'u1',
      fullName: 'Juan',
      neighborhoodId: 'n1',
      roles: ['GUARD'],
    });
    expect(user?.neighborhoodTimezone).toBeNull();
  });

  it('trata neighborhoodTimezone vacio como null', () => {
    const user = toSessionUser({
      id: 'u1',
      fullName: 'Juan',
      neighborhoodId: 'n1',
      neighborhoodTimezone: '',
      roles: ['GUARD'],
    });
    expect(user?.neighborhoodTimezone).toBeNull();
  });

  it('devuelve null sin id, nombre o barrio', () => {
    expect(toSessionUser({ fullName: 'Juan', neighborhoodId: 'n1', neighborhoodTimezone: 'America/Argentina/Mendoza', roles: ['GUARD'] })).toBeNull();
    expect(toSessionUser({ id: 'u1', neighborhoodId: 'n1', neighborhoodTimezone: 'America/Argentina/Mendoza', roles: ['GUARD'] })).toBeNull();
    expect(toSessionUser({ id: 'u1', fullName: 'Juan', neighborhoodTimezone: 'America/Argentina/Mendoza', roles: ['GUARD'] })).toBeNull();
  });

  it('devuelve null sin roles', () => {
    expect(toSessionUser({ id: 'u1', fullName: 'Juan', neighborhoodId: 'n1', neighborhoodTimezone: 'America/Argentina/Mendoza' })).toBeNull();
  });

  it('usa [] cuando no hay lots', () => {
    const user = toSessionUser({
      id: 'u1',
      fullName: 'Juan',
      neighborhoodId: 'n1',
      neighborhoodTimezone: 'America/Argentina/Mendoza',
      roles: ['GUARD'],
    });
    expect(user?.lots).toEqual([]);
  });
});

describe('isSessionUser', () => {
  it('acepta un usuario persistido valido', () => {
    expect(isSessionUser(baseUser)).toBe(true);
  });

  it('rechaza null, primitivos y objetos incompletos', () => {
    expect(isSessionUser(null)).toBe(false);
    expect(isSessionUser('usuario')).toBe(false);
    expect(isSessionUser({ id: 'u1', fullName: 'Juan' })).toBe(false);
    expect(isSessionUser({ ...baseUser, roles: 'GUARD' })).toBe(false);
    expect(isSessionUser({ ...baseUser, lots: 'l1' })).toBe(false);
  });

  it('rechaza roles con elementos que no son string', () => {
    expect(isSessionUser({ ...baseUser, roles: ['GUARD', 7] })).toBe(false);
  });

  it('acepta sesiones persistidas sin neighborhoodTimezone', () => {
    const { neighborhoodTimezone: _tz, ...legacyUser } = baseUser;
    expect(isSessionUser(legacyUser)).toBe(true);
  });

  it('rechaza neighborhoodTimezone con tipo invalido', () => {
    expect(isSessionUser({ ...baseUser, neighborhoodTimezone: 123 })).toBe(false);
  });
});

describe('residentLots', () => {
  it('deja afuera las casas donde trabaja: el JWT no las incluye y darian 403', () => {
    const user: SessionUser = {
      ...baseUser,
      lots: [
        { id: 'casa', code: 'M4-L12', canInvite: true, isOwner: true, kind: 'OWNER' },
        { id: 'familia', code: 'M5-L01', canInvite: true, isOwner: false, kind: 'MEMBER' },
        { id: 'trabajo', code: 'M9-L03', canInvite: false, isOwner: false, kind: 'WORKER' },
      ],
    };
    expect(residentLots(user).map((lot) => lot.id)).toEqual(['casa', 'familia']);
  });
});
