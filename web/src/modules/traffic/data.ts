export const MAX_AXIS_TICKS = 10;

// Formatos de fecha del grafico (siempre en la zona del barrio).
export const HOUR_LABEL = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
} as const;

export const DAY_LABEL = { weekday: "short", day: "numeric", month: "short" } as const;
