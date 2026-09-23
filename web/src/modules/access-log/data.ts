import type { ResultFilter } from "@/modules/access-log/types";

export const RESULT_OPTIONS: { value: ResultFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "ALLOWED", label: "Permitidos" },
  { value: "DENIED", label: "Denegados" },
];

export const EXPORT_MESSAGES = {
  done: "CSV exportado.",
  invalidRange: "El rango no es válido: el máximo es de 90 días. Acortá el rango y exportá de nuevo.",
  error: "No se pudo exportar. Revisá la conexión y reintentá.",
} as const;
