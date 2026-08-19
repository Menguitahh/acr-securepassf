import type { components } from '@securepass/contracts';

export const TYPE_LABELS: Record<
  NonNullable<components['schemas']['InvitationResponse']['type']>,
  string
> = {
  SINGLE: 'Unica',
  EVENT: 'Evento',
  RECURRING: 'Recurrente',
};

export const STATUS_LABELS: Record<
  NonNullable<components['schemas']['InvitationResponse']['status']>,
  string
> = {
  ACTIVE: 'Activa',
  USED: 'Usada',
  EXPIRED: 'Vencida',
  REVOKED: 'Revocada',
};
