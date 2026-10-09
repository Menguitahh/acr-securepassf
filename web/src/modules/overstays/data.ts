import { createSortedRowModel, rowSortingFeature, sortFn_text, tableFeatures } from "@tanstack/react-table";

export const OVERSTAYS_REFETCH_MS = 60_000;

// Solo el feature que la tabla usa: ordenar por columna (react-table v9
// registra features y row models explicitamente).
export const OVERSTAY_FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
});

// Default de la spec (US-31): mas horas adentro primero.
export const INITIAL_SORTING = [{ id: "minutesElapsed", desc: true }];
