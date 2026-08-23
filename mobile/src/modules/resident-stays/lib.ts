import type { Stay } from '@/modules/stays/types';

// Solo estadias marcadas warned por el server y con invitacion asociada:
// MANUAL (invitationId null) no tiene invitacion sobre la que extender
// ni request-exit — la accion tendria que hacerla el guardia in situ.
export function pendingResidentStays(stays: readonly Stay[]): Stay[] {
  return stays.filter(
    (stay) => stay.warned === true && typeof stay.invitationId === 'string',
  );
}

export function exitAlreadyRequested(stay: Stay): boolean {
  return typeof stay.exitRequestedAt === 'string' && stay.exitRequestedAt.length > 0;
}
