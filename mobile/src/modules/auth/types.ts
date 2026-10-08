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

export type ReassignDecision = 'reassign' | 'cancel';

export type NeighborhoodCheckOutcome = 'continue' | 'cancelled';

export type NeighborhoodCheckDeps = {
  // Ultimo barrio que uso este dispositivo. Device-scoped: no se borra en
  // el logout, porque justamente sirve para detectar la reasignacion.
  loadLastNeighborhood: () => Promise<string | null>;
  saveLastNeighborhood: (neighborhoodId: string) => Promise<void>;
  countPending: () => number;
  wipeLocalDatabase: () => void;
  promptReassign: (pending: number) => Promise<ReassignDecision>;
};
