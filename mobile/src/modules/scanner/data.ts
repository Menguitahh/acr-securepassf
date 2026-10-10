import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { DenialReason, Direction } from '@/modules/scanner/types';

export const TOKEN_PREFIX = 'SP1.';

// Garita fija del dispositivo. WBS-38 (turnos) la reemplaza por la
// garita del turno abierto.
export const GATE_ID = process.env.EXPO_PUBLIC_GATE_ID;

export const DUPLICATE_WINDOW_MS = 3000;

export const DENIAL_MESSAGES: Record<DenialReason, string> = {
  INVALID_SIGNATURE: 'Pase inválido. Pedí un pase nuevo al residente.',
  REVOKED: 'Pase revocado por el residente.',
  NOT_YET_VALID: 'Pase todavía no vigente. Revisá el horario de inicio.',
  EXPIRED: 'Pase vencido. Pedí un pase nuevo al residente.',
  OUT_OF_SCHEDULE: 'Fuera del horario del pase. Revisá los días y horarios permitidos.',
  ALREADY_USED: 'Cupo del pase agotado. Pedí un pase nuevo al residente.',
  LOT_SUSPENDED: 'Lote suspendido. El residente no puede recibir visitas.',
  REPLAY: 'Pase ya utilizado. Si es un error del sistema, registrá el ingreso manualmente.',
  NEIGHBORHOOD_TZ_MISSING:
    'Falta configuración del barrio en este dispositivo. El pase puede ser válido; registrá el ingreso manualmente.',
  WORKER_NOT_SYNCED:
    'Este trabajador todavía no está cargado en este dispositivo. Registrá el ingreso manualmente.',
  UNKNOWN: 'Pase no válido. Registrá el ingreso manualmente o pedí un pase nuevo.',
};

// Panel del guardia (#232). Celdas iguales de 64 dp: mas que el minimo de
// 48 dp para tocar con guantes, y entra un texto de 2 lineas.
export const ACTION_TILE_HEIGHT = 64;
export const ACTION_GRID_GAP = 8;
export const PANEL_PADDING = 16;
// Desde este ancho (tablet, telefono horizontal) las 4 acciones van en una fila.
export const WIDE_LAYOUT_MIN_WIDTH = 600;

export const DIRECTION_OPTIONS: readonly {
  value: Direction;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { value: 'IN', label: 'Ingreso', icon: 'enter-outline' },
  { value: 'OUT', label: 'Egreso', icon: 'exit-outline' },
];
