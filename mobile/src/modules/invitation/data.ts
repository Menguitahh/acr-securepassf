import type { components } from '@securepass/contracts';

type InvitationType = NonNullable<components['schemas']['InvitationResponse']['type']>;

const TYPE_LABELS: Record<InvitationType, string> = {
  SINGLE: 'Unica',
  EVENT: 'Evento',
};

// Fallback si el server manda un type desconocido (ej RECURRING viejo sin
// migrar, o un tipo nuevo que este cliente no conoce todavia). No mostrar
// undefined ni el enum crudo al residente — el chip vacio deja al usuario
// sin saber si es bug o pase roto.
export function typeLabel(type: string | undefined | null): string {
  if (type && type in TYPE_LABELS) return TYPE_LABELS[type as InvitationType];
  return 'Pase';
}

export const STATUS_LABELS: Record<
  NonNullable<components['schemas']['InvitationResponse']['status']>,
  string
> = {
  ACTIVE: 'Activa',
  USED: 'Usada',
  EXPIRED: 'Vencida',
  REVOKED: 'Revocada',
};
