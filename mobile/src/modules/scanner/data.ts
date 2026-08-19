import type { OfflineDenialReason } from '@/modules/scanner/types';

export const TOKEN_PREFIX = 'SP1.';

export const DENIAL_MESSAGES: Record<OfflineDenialReason, string> = {
  INVALID_SIGNATURE: 'Pase invalido. Pedí un pase nuevo al residente.',
  REVOKED: 'Pase revocado por el residente.',
  NOT_YET_VALID: 'Pase todavia no vigente. Revisá el horario de inicio.',
  EXPIRED: 'Pase vencido. Pedí un pase nuevo al residente.',
  OUT_OF_SCHEDULE: 'Fuera del horario del pase. Revisá los dias y horarios permitidos.',
  ALREADY_USED: 'Cupo del pase agotado. Pedí un pase nuevo al residente.',
  UNKNOWN: 'Pase no valido. Registrá el ingreso manualmente o pedí un pase nuevo.',
};
