import { NEAR_EXPIRY_MINUTES } from '@/modules/stays/data';
import type { Stay } from '@/modules/stays/types';

// Solo estadias marcadas warned por el server y con invitacion asociada:
// MANUAL (invitationId null) no tiene invitacion sobre la que extender
// ni request-exit — la accion tendria que hacerla el guardia in situ.
// Una ya extendida mas alla del umbral sale de la card: warned queda en el
// server (BR-15, un aviso por estadia), pero ya no esta por vencer.
export function pendingResidentStays(stays: readonly Stay[]): Stay[] {
  return stays.filter(
    (stay) =>
      stay.warned === true &&
      typeof stay.invitationId === 'string' &&
      !(typeof stay.minutesRemaining === 'number' && stay.minutesRemaining > NEAR_EXPIRY_MINUTES),
  );
}

export function exitAlreadyRequested(stay: Stay): boolean {
  return typeof stay.exitRequestedAt === 'string' && stay.exitRequestedAt.length > 0;
}
