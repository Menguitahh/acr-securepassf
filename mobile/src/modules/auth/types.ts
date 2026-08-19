import type { components } from '@securepass/contracts';

export type SessionUser = {
  id: string;
  fullName: string;
  neighborhoodId: string;
  roles: string[];
  lots: components['schemas']['LotPayload'][];
};

export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';
