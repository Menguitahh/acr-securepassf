const LOCALE = "es-AR";

// Intl tira RangeError con una zona que no conoce. Se valida al armar la
// sesion, asi ningun formateo posterior puede romper la pagina por la tz.
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone.length === 0) return false;
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Instante del server (ISO con Z u offset) en la hora del barrio, nunca en
// la del navegador. Un valor invalido muestra un guion en vez de romper
// la fila o la pagina entera.
export function formatInTz(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone }).format(date);
}

// Fecha civil sin hora ("2026-09-23"). new Date("2026-09-23") es medianoche
// UTC y en Argentina se ve como el 22: se ancla y se formatea en UTC para
// que ningun offset la corra de dia.
export function formatLocalDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
  const anchored = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(anchored.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(anchored);
}
