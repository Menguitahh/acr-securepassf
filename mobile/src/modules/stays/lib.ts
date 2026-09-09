import { NEAR_EXPIRY_MINUTES, WARNING_LEAD_MINUTES } from '@/modules/stays/data';
import type { Stay } from '@/modules/stays/types';

const MINUTE_MS = 60_000;

export type WarningSchedule =
  | { action: 'schedule'; fireAt: number }
  | { action: 'fireNow' }
  | { action: 'cancel' }
  | { action: 'markWarned'; divergent: boolean }
  | { action: 'skip'; reason: 'no-expected-until' | 'already-warned' | 'already-past' };

// Decide que hacer con una estadia respecto al aviso local. Pura,
// testeable sin expo-notifications ni SQLite.
//
// Los tres inputs de estado forman una tabla de decisiones (#31):
// | locallyWarned | locallySynced | server.warned | action           |
// | true          | true          | true          | skip (yo dueño)   |
// | true          | true          | false         | markWarned (dvg)  |
// | true          | false         | true          | cancel            |
// | true          | false         | false         | markWarned        |
// | false         | *             | true          | skip              |
// | false         | *             | false         | schedule/fireNow  |
//
// - `cancel`: otro device fue dueño del aviso — cancelar mi notif local
//   pendiente para no duplicar. Cross-device, cambio de turno.
// - `markWarned`: POST /stays/{id}/mark-warned no llego al server todavia
//   (o llego y despues divergio: `divergent=true`). Reintentar es
//   idempotente por first-writer-wins del server; si yo tenia razon
//   confirma, si el server tenia razon corrige. Divergent=true adicional
//   pinta el log porque significa que O el server perdio el mark O el
//   flag local miente — vale la pena visibilidad.
// - `skip (yo dueño)`: server.warned=true por MI POST. No cancelar mi
//   notif local; es la que va a avisar al guardia.
export function computeWarningSchedule(
  stay: Stay,
  now: number,
  locallyWarned: boolean,
  locallySynced: boolean,
): WarningSchedule {
  if (locallyWarned && locallySynced) {
    if (stay.warned === true) {
      return { action: 'skip', reason: 'already-warned' };
    }
    return { action: 'markWarned', divergent: true };
  }
  if (locallyWarned) {
    if (stay.warned === true) {
      return { action: 'cancel' };
    }
    return { action: 'markWarned', divergent: false };
  }
  if (stay.warned === true) {
    return { action: 'skip', reason: 'already-warned' };
  }
  if (!stay.expectedUntil) {
    return { action: 'skip', reason: 'no-expected-until' };
  }
  const expected = Date.parse(stay.expectedUntil);
  if (Number.isNaN(expected)) return { action: 'skip', reason: 'no-expected-until' };

  const fireAt = expected - WARNING_LEAD_MINUTES * MINUTE_MS;
  if (fireAt <= now) {
    if (expected + WARNING_LEAD_MINUTES * MINUTE_MS < now) {
      return { action: 'skip', reason: 'already-past' };
    }
    return { action: 'fireNow' };
  }
  return { action: 'schedule', fireAt };
}

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
