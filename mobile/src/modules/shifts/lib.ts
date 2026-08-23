import type { Shift } from '@/modules/shifts/types';

export function isOpenShift(shift: Shift | null | undefined): shift is Shift {
  if (!shift) return false;
  return typeof shift.id === 'string' && !shift.endedAt;
}

export function elapsedMinutes(startedAtIso: string | undefined, now: number): number | null {
  if (!startedAtIso) return null;
  const started = Date.parse(startedAtIso);
  if (Number.isNaN(started)) return null;
  const diff = Math.max(0, now - started);
  return Math.floor(diff / 60_000);
}

// "3h 12m" / "45m" / "0m". No usa Intl porque las variantes en es-AR
// para duracion son verbosas ("3 horas 12 minutos"); en garita conviene
// algo escaneable con vista periferica.
export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
