import { EXTEND_ACTION, REQUEST_EXIT_ACTION } from '@/modules/resident-stays/data';
import type { StayWarningAction } from '@/modules/resident-stays/types';
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

// #33: que hacer con la respuesta a un push. Solo los dos botones del aviso
// de permanencia con un invitationId; tocar la notificacion (accion por
// defecto) solo abre la app, donde esta la card con los mismos botones.
export function parseStayWarningAction(actionIdentifier: string, data: unknown): StayWarningAction | null {
  const kind =
    actionIdentifier === EXTEND_ACTION ? 'extend' : actionIdentifier === REQUEST_EXIT_ACTION ? 'request_exit' : null;
  if (!kind || typeof data !== 'object' || data === null) return null;
  if (!('type' in data) || data.type !== 'stay-warning') return null;
  if (!('invitationId' in data) || typeof data.invitationId !== 'string' || data.invitationId.length === 0) return null;
  return { kind, invitationId: data.invitationId };
}
