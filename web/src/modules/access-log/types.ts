import type { DateRange, InstantRange } from "@/common/date-range/types";

export type ResultFilter = "ALL" | "ALLOWED" | "DENIED";

// Cada respuesta del export es un caso distinto para el admin: el 429 no es
// un error (hay otra exportacion corriendo), el 422 es un rango invalido.
export type ExportOutcome =
  | { kind: "file"; blob: Blob; fileName: string }
  | { kind: "busy"; retryAfterSeconds: number | null }
  | { kind: "invalidRange" }
  | { kind: "error" };

export type ExportNotice = { tone: "status" | "alert"; text: string };

export type ExportRequest = {
  range: DateRange;
  instants: InstantRange;
  result: ResultFilter;
};
