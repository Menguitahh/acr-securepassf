import { NEAR_EXPIRY_MINUTES, WARNING_LEAD_MINUTES } from '@/modules/stays/data';
import type { Stay } from '@/modules/stays/types';

const MINUTE_MS = 60_000;

export type WarningSchedule =
  | { action: 'schedule'; fireAt: number }
  | { action: 'fireNow' }
  | { action: 'cancel' }
  | { action: 'skip'; reason: 'no-expected-until' | 'already-warned' | 'already-past' };

// Decide que hacer con una estadia respecto al aviso local. Pura,
// testeable sin expo-notifications.
//
// - Local scheduled + server confirma warned=true: cancel. Caso
//   cross-device — otro device de garita disparo el aviso y llamo
//   mark-warned server-side; este device tiene la notif local
//   programada pero no disparada, hay que cancelarla para no
//   duplicar el aviso al guardia. Hoy no se ejecuta en produccion:
//   stays.warned SIEMPRE viene false del server hasta que backend
//   implemente el endpoint mark-warned (~150 loc pendientes).
//   Se deja anticipando el escenario del cambio de turno con dos
//   guardias montados en paralelo.
// - Ya avisado (server o local): skip.
// - expected_until - lead ya paso pero la estadia sigue abierta y
//   dentro de una ventana razonable (lead adicional): dispara ya.
// - fireAt en el futuro: schedule.
export function computeWarningSchedule(
  stay: Stay,
  now: number,
  locallyWarned: boolean,
): WarningSchedule {
  if (locallyWarned && stay.warned === true) {
    return { action: 'cancel' };
  }
  if (stay.warned === true || locallyWarned) {
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
