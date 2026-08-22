import { NEAR_EXPIRY_MINUTES } from '@/modules/stays/data';
import type { Stay } from '@/modules/stays/types';

// Presentes ordenados por hora de ingreso descendente: el ultimo que
// entro va arriba. Los que no tienen enteredAt se ubican al final para
// no perderlos (deberian ser raros; auditoria server-side los detecta).
export function sortByEnteredAtDesc(stays: readonly Stay[]): Stay[] {
  return [...stays].sort((a, b) => {
    const at = a.enteredAt ? Date.parse(a.enteredAt) : 0;
    const bt = b.enteredAt ? Date.parse(b.enteredAt) : 0;
    return bt - at;
  });
}

export function isNearExpiry(stay: Stay): boolean {
  if (stay.warned === true) return true;
  return (
    typeof stay.minutesRemaining === 'number' &&
    stay.minutesRemaining <= NEAR_EXPIRY_MINUTES
  );
}

export function formatEnteredAt(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
