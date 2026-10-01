import type { DateRange, InstantRange } from "@/common/date-range/types";

export type ResultFilter = "ALL" | "ALLOWED" | "DENIED";

// xlsx para leer e imprimir en Excel, csv para importar en otro sistema.
export type ExportFormat = "xlsx" | "csv";

// Cada respuesta del export es un caso distinto para el admin: el 429 no es
// un error (hay otra exportacion corriendo), y el 422 trae el motivo en
// `rule`: rango invalido o mas filas que el limite del XLSX.
export type ExportOutcome =
  | { kind: "file"; format: ExportFormat; blob: Blob; fileName: string }
  | { kind: "busy"; retryAfterSeconds: number | null }
  | { kind: "invalidRange" }
  | { kind: "tooManyRows" }
  | { kind: "error" };

export type ExportNotice = { tone: "status" | "alert"; text: string };

export type ExportRequest = {
  format: ExportFormat;
  range: DateRange;
  instants: InstantRange;
  result: ResultFilter;
};
