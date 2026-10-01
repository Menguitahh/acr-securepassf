import type { ExportFormat, ResultFilter } from "@/modules/access-log/types";

export const RESULT_OPTIONS: { value: ResultFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "ALLOWED", label: "Permitidos" },
  { value: "DENIED", label: "Denegados" },
];

// "Excel" y no "XLSX": es la palabra que usa el admin. La extension igual
// se ve en el archivo descargado. Boton y aviso usan la misma palabra.
export const EXPORT_FORMATS = {
  xlsx: {
    path: "/api/v1/admin/reports/access-logs.xlsx",
    extension: "xlsx",
    action: "Exportar a Excel",
    done: "Exportado a Excel.",
  },
  csv: {
    path: "/api/v1/admin/reports/access-logs.csv",
    extension: "csv",
    action: "Exportar CSV",
    done: "CSV exportado.",
  },
} as const satisfies Record<ExportFormat, { path: string; extension: string; action: string; done: string }>;

// Excel primero y como boton principal: es el que usa el admin para leer.
export const EXPORT_FORMAT_ORDER: readonly ExportFormat[] = ["xlsx", "csv"];

export const PRIMARY_BUTTON =
  "min-h-12 rounded-md bg-text-primary px-5 font-medium text-bg-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary disabled:opacity-60";
export const SECONDARY_BUTTON =
  "min-h-12 rounded-md border border-border px-5 font-medium hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary disabled:opacity-60";

// Valores de `rule` del ProblemDetail del 422 (securepassb#200). No estan
// tipados en el contrato: securepassb#196.
export const EXPORT_RULES = {
  range: "export-range",
  rows: "export-rows",
} as const;

export const EXPORT_MESSAGES = {
  invalidRange: "El rango no es válido: el máximo es de 90 días. Acortá el rango y exportá de nuevo.",
  tooManyRows: "El rango supera el máximo de filas para Excel. Acortá el rango o exportá en CSV.",
  error: "No se pudo exportar. Revisá la conexión y reintentá.",
} as const;
