import { NEAR_EXPIRY_MINUTES, WARNING_LEAD_MINUTES } from '@/modules/stays/data';
import type { LocalWarning, Stay } from '@/modules/stays/types';

const MINUTE_MS = 60_000;

export type WarningSchedule =
  | { action: 'schedule'; fireAt: number }
  | { action: 'fireNow' }
  // El aviso local ya vencio y el server no lo sabe: POST mark-warned.
  | { action: 'markWarned' }
  // Otro dispositivo aviso primero: cancelar el aviso pendiente de este.
  | { action: 'cancel' }
  | { action: 'skip'; reason: 'no-expected-until' | 'already-warned' | 'already-past' | 'scheduled' };

const STAY_STRING_FIELDS = [
  'id',
  'invitationId',
  'subjectName',
  'lotCode',
  'enteredAt',
  'expectedUntil',
  'exitRequestedAt',
] as const;

// #208: ultima lista de presentes guardada, para arrancar sin red.
// minutesRemaining lo calculo el server al guardar: se recalcula con
// expectedUntil para no mostrar un "faltan" de hace horas. undefined =
// nada guardado o ilegible.
export function parseStoredStays(value: unknown, now: number): Stay[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: unknown[] = value;
  const stays: Stay[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) return undefined;
    const stay: Stay = {};
    for (const key of STAY_STRING_FIELDS) {
      const field: unknown = Reflect.get(item, key);
      if (typeof field === 'string') stay[key] = field;
    }
    const warned: unknown = Reflect.get(item, 'warned');
    if (typeof warned === 'boolean') stay.warned = warned;
    if (typeof stay.id !== 'string') return undefined;
    const expected = stay.expectedUntil ? Date.parse(stay.expectedUntil) : Number.NaN;
    if (!Number.isNaN(expected)) stay.minutesRemaining = Math.floor((expected - now) / MINUTE_MS);
    stays.push(stay);
  }
  return stays;
}

// Momento del aviso: expected_until - lead. Null si no hay fecha valida.
export function warningFireAt(stay: Stay): number | null {
  if (!stay.expectedUntil) return null;
  const expected = Date.parse(stay.expectedUntil);
  if (Number.isNaN(expected)) return null;
  return expected - WARNING_LEAD_MINUTES * MINUTE_MS;
}

// El aviso local de este dispositivo ya vencio: la fila se resalta. Programar
// un aviso para dentro de horas no es haber avisado (#31).
export function isWarningDue(stay: Stay, local: LocalWarning | undefined, now: number): boolean {
  if (!local) return false;
  const fireAt = local.fireAt ?? warningFireAt(stay);
  return fireAt !== null && fireAt <= now;
}

// Decide que hacer con una estadia respecto al aviso local. Pura,
// testeable sin expo-notifications ni SQLite.
//
// Sin aviso local:
// - server.warned: otro dispositivo ya aviso, skip.
// - fireAt en el futuro: schedule. Ya paso pero dentro de la ventana: fireNow.
// Con aviso local (#31, el server se marca warned recien al vencer):
// - server.warned y el mio ya vencio o lo marque yo: skip.
// - server.warned y el mio sigue pendiente: otro aviso primero, cancel.
// - el mio no vencio: skip, la notificacion ya esta programada.
// - el mio vencio y el server no lo sabe (nunca lo mande, o se perdio): markWarned.
export function computeWarningSchedule(
  stay: Stay,
  now: number,
  local: LocalWarning | undefined,
): WarningSchedule {
  if (local) {
    const due = isWarningDue(stay, local, now);
    if (stay.warned === true) {
      return due || local.synced ? { action: 'skip', reason: 'already-warned' } : { action: 'cancel' };
    }
    return due ? { action: 'markWarned' } : { action: 'skip', reason: 'scheduled' };
  }
  if (stay.warned === true) {
    return { action: 'skip', reason: 'already-warned' };
  }
  const fireAt = warningFireAt(stay);
  if (fireAt === null) return { action: 'skip', reason: 'no-expected-until' };
  if (fireAt <= now) {
    if (fireAt + 2 * WARNING_LEAD_MINUTES * MINUTE_MS < now) {
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

// Tiempo que le queda a la estadia, legible de un vistazo: "Quedan 23 h 31
// min" en vez de "1411 min", que se leia como tiempo transcurrido.
export function formatRemaining(minutes: number): string {
  if (minutes <= 0) return 'Vencido';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `Quedan ${rest} min`;
  return rest === 0 ? `Quedan ${hours} h` : `Quedan ${hours} h ${rest} min`;
}

export function formatEnteredAt(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
