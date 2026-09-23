import { createSortedRowModel, rowSortingFeature, sortFn_text, tableFeatures } from "@tanstack/react-table";

export const OVERSTAYS_REFETCH_MS = 60_000;

// Horas de la tabla, siempre en la zona del barrio.
export const STAY_TIME = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
} as const;

// Solo el feature que la tabla usa: ordenar por columna (react-table v9
// registra features y row models explicitamente).
export const OVERSTAY_FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
});

// Default de la spec (US-31): mas horas adentro primero.
export const INITIAL_SORTING = [{ id: "minutesElapsed", desc: true }];
