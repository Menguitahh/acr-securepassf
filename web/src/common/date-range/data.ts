export const DEFAULT_RANGE_DAYS = 7;

// Tope del backend para rangos del dashboard (traffic y export CSV).
export const MAX_RANGE_DAYS = 90;

export const RANGE_ERRORS = {
  missing: "Elegí la fecha de inicio y la de fin.",
  inverted: "La fecha de fin tiene que ser igual o posterior a la de inicio.",
  tooLong: `El rango máximo es de ${MAX_RANGE_DAYS} días. Acortá el rango.`,
} as const;
