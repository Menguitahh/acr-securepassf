import type { DenialReason } from '@/modules/scanner/types';

export const TOKEN_PREFIX = 'SP1.';

// Garita fija del dispositivo. WBS-38 (turnos) la reemplaza por la
// garita del turno abierto.
export const GATE_ID = process.env.EXPO_PUBLIC_GATE_ID;

export const DUPLICATE_WINDOW_MS = 3000;

export const DENIAL_MESSAGES: Record<DenialReason, string> = {
  INVALID_SIGNATURE: 'Pase invalido. Pedí un pase nuevo al residente.',
  REVOKED: 'Pase revocado por el residente.',
  NOT_YET_VALID: 'Pase todavia no vigente. Revisá el horario de inicio.',
  EXPIRED: 'Pase vencido. Pedí un pase nuevo al residente.',
  OUT_OF_SCHEDULE: 'Fuera del horario del pase. Revisá los dias y horarios permitidos.',
  ALREADY_USED: 'Cupo del pase agotado. Pedí un pase nuevo al residente.',
  LOT_SUSPENDED: 'Lote suspendido. El residente no puede recibir visitas.',
  REPLAY: 'Pase ya utilizado. Si es un error del sistema, registrá el ingreso manualmente.',
  UNKNOWN: 'Pase no valido. Registrá el ingreso manualmente o pedí un pase nuevo.',
};
