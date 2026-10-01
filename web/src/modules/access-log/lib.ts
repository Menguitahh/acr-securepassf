import type { DateRange } from "@/common/date-range/types";
import { EXPORT_FORMATS, EXPORT_MESSAGES, EXPORT_RULES } from "@/modules/access-log/data";
import type { ExportFormat, ExportNotice, ExportOutcome } from "@/modules/access-log/types";

// El nombre lo arma el backend, que conoce la zona del barrio
// (securepassb#198). Solo la forma que manda: filename="...", sin filename*.
export function fileNameFromDisposition(header: string | null): string | null {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}

// Fallback si el header no llega (CORS sin Expose-Headers, proxy): el archivo
// ya esta descargado, no se pierde por el nombre. Mismas fechas inclusivas
// que eligio el admin.
export function exportFileName(range: DateRange, format: ExportFormat): string {
  return `access-logs-${range.from}-${range.to}.${EXPORT_FORMATS[format].extension}`;
}

// El body del error llega sin tipo (el 422 no tiene schema en el contrato).
export function problemRule(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("rule" in body)) return null;
  return typeof body.rule === "string" ? body.rule : null;
}

// Un 422 sin rule conocido no se muestra como rango invalido: el admin
// acortaria el rango por un problema que no es ese.
export function unprocessableOutcome(body: unknown): ExportOutcome {
  switch (problemRule(body)) {
    case EXPORT_RULES.range:
      return { kind: "invalidRange" };
    case EXPORT_RULES.rows:
      return { kind: "tooManyRows" };
    default:
      return { kind: "error" };
  }
}

// Retry-After en segundos (el backend no manda la variante con fecha).
export function retryAfterSeconds(header: string | null): number | null {
  if (!header || !/^\d+$/.test(header.trim())) return null;
  const seconds = Number(header);
  return seconds > 0 ? seconds : null;
}

export function busyMessage(seconds: number | null): string {
  if (seconds === null) return "Hay otra exportación en curso. Reintentá en unos segundos.";
  const unit = seconds === 1 ? "segundo" : "segundos";
  return `Hay otra exportación en curso. Reintentá en ${seconds} ${unit}.`;
}

// El 429 va como aviso (status), no como error (alert).
export function exportNotice(outcome: ExportOutcome): ExportNotice {
  switch (outcome.kind) {
    case "file":
      return { tone: "status", text: EXPORT_FORMATS[outcome.format].done };
    case "busy":
      return { tone: "status", text: busyMessage(outcome.retryAfterSeconds) };
    case "invalidRange":
      return { tone: "alert", text: EXPORT_MESSAGES.invalidRange };
    case "tooManyRows":
      return { tone: "alert", text: EXPORT_MESSAGES.tooManyRows };
    case "error":
      return { tone: "alert", text: EXPORT_MESSAGES.error };
  }
}
