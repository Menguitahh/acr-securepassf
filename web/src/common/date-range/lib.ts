import { DEFAULT_RANGE_DAYS, MAX_RANGE_DAYS, RANGE_ERRORS } from "@/common/date-range/data";
import type { DateRange, RangeCheck } from "@/common/date-range/types";

const DAY_MS = 86_400_000;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Offset de la zona en ese instante, en minutos ("GMT-03:00" -> -180).
// Por instante y no fijo: una zona con horario de verano cambia en el año.
function offsetMinutes(instantMs: number, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(instantMs)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function civilDateMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(civilDateMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

// Primer instante de esa fecha en la zona del barrio, como ISO UTC. Dos
// candidatos (offset antes y despues de un posible cambio de horario); gana
// el mas temprano que cae en esa fecha. Si la medianoche no existe (el
// reloj salta de 00:00 a 01:00), el dia arranca a la 01:00.
export function zonedMidnight(date: string, timeZone: string): string {
  const guess = civilDateMs(date);
  const first = guess - offsetMinutes(guess, timeZone) * 60_000;
  const second = guess - offsetMinutes(first, timeZone) * 60_000;
  const onDate = [first, second].filter((ms) => todayIn(timeZone, new Date(ms)) === date);
  return new Date(Math.min(...(onDate.length ? onDate : [first]))).toISOString();
}

export function todayIn(timeZone: string, now: Date): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export function defaultRange(timeZone: string, now: Date): DateRange {
  const to = todayIn(timeZone, now);
  return { from: addDays(to, -(DEFAULT_RANGE_DAYS - 1)), to };
}

// Fechas inclusivas del form -> [medianoche del inicio, medianoche del dia
// siguiente al fin) en la zona del barrio, que es lo que espera el backend.
export function checkRange(range: DateRange, timeZone: string): RangeCheck {
  if (!CIVIL_DATE.test(range.from) || !CIVIL_DATE.test(range.to)) {
    return { ok: false, message: RANGE_ERRORS.missing };
  }
  const days = (civilDateMs(range.to) - civilDateMs(range.from)) / DAY_MS + 1;
  if (Number.isNaN(days)) return { ok: false, message: RANGE_ERRORS.missing };
  if (days < 1) return { ok: false, message: RANGE_ERRORS.inverted };
  if (days > MAX_RANGE_DAYS) return { ok: false, message: RANGE_ERRORS.tooLong };
  return {
    ok: true,
    instants: {
      from: zonedMidnight(range.from, timeZone),
      to: zonedMidnight(addDays(range.to, 1), timeZone),
    },
  };
}
