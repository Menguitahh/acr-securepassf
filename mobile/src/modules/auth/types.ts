import type { components } from '@securepass/contracts';

export type SessionUser = {
  id: string;
  fullName: string;
  neighborhoodId: string;
  // Null solo para sesiones persistidas antes de que el backend enviara el
  // campo (securepassb#155). Sesiones nuevas siempre lo traen; sin tz, el
  // scanner cae en NEIGHBORHOOD_TZ_MISSING en pases RECURRING.
  neighborhoodTimezone: string | null;
  roles: string[];
  lots: components['schemas']['LotPayload'][];
};

export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';

// Por que se corto la sesion, para explicarlo en el login. null: el usuario
// cerro sesion, o nunca la tuvo.
export type SignOutReason = 'expired' | null;
