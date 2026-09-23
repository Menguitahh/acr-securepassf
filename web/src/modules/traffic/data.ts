export const DEFAULT_RANGE_DAYS = 7;

// Tope del backend (AdminMetricsController.MAX_TRAFFIC_RANGE).
export const MAX_RANGE_DAYS = 90;

export const MAX_AXIS_TICKS = 10;

export const RANGE_ERRORS = {
  missing: "Elegí la fecha de inicio y la de fin.",
  inverted: "La fecha de fin tiene que ser igual o posterior a la de inicio.",
  tooLong: `El rango máximo es de ${MAX_RANGE_DAYS} días. Acortalo para ver el gráfico.`,
} as const;

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
