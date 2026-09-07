// WBS-118 + securepassf #64: evaluacion de franja horaria compartida por
// worker (permisos de trabajador) e invitaciones RECURRING. La tz es
// argumento del caller (tz del barrio), nunca la del dispositivo.
//
// La firma se congela primero para que los tests golden vivan detras de una
// interfaz estable; el cuerpo se implementa recien cuando el probe de
// Hermes+Intl decida entre Intl.DateTimeFormat y una lib con tzdata (ej
// @date-fns/tz). Los tests no se reescriben en ninguno de los dos caminos.
//
// Paridad con backend ScheduleWindow.contains (Java):
//   - weekdays ISO 1..7 (1=lunes .. 7=domingo)
//   - dailyFrom y dailyUntil en "HH:mm", ambos inclusive
//   - fail-closed: tz vacia, weekdays vacio, formatos invalidos => false
//   - una hora local en la tz del argumento, nunca la del dispositivo

export type ScheduleWindow = {
  weekdays: number[]; // ISO: 1=lunes..7=domingo
  dailyFrom: string; // "HH:mm"
  dailyUntil: string; // "HH:mm"
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Intl.DateTimeFormat con weekday: 'short' en en-US devuelve "Mon".."Sun".
// Mapeamos a ISO 1..7 (1=lunes..7=domingo) para casar con el backend.
const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function scheduleContains(
  window: ScheduleWindow,
  capturedAtSeconds: number,
  timezone: string,
): boolean {
  if (!timezone) return false;
  if (!Array.isArray(window.weekdays) || window.weekdays.length === 0) return false;
  const fromMatch = TIME_PATTERN.exec(window.dailyFrom);
  const untilMatch = TIME_PATTERN.exec(window.dailyUntil);
  if (!fromMatch || !untilMatch) return false;

  let parts: Intl.DateTimeFormatPart[];
  try {
    // hourCycle: 'h23' evita el bug de en-US que devuelve "24" a medianoche.
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    parts = formatter.formatToParts(new Date(capturedAtSeconds * 1000));
  } catch {
    return false;
  }

  const weekdayPart = parts.find((p) => p.type === 'weekday')?.value;
  const hourPart = parts.find((p) => p.type === 'hour')?.value;
  const minutePart = parts.find((p) => p.type === 'minute')?.value;
  if (!weekdayPart || !hourPart || !minutePart) return false;

  const isoDay = WEEKDAY_TO_ISO[weekdayPart];
  if (!isoDay) return false;
  if (!window.weekdays.includes(isoDay)) return false;

  const nowMinutes = Number(hourPart) * 60 + Number(minutePart);
  const fromMinutes = Number(fromMatch[1]) * 60 + Number(fromMatch[2]);
  const untilMinutes = Number(untilMatch[1]) * 60 + Number(untilMatch[2]);
  return nowMinutes >= fromMinutes && nowMinutes <= untilMinutes;
}
