import type { DateRange } from "@/common/date-range/types";
import { EXPORT_MESSAGES } from "@/modules/access-log/data";
import type { ExportNotice, ExportOutcome } from "@/modules/access-log/types";

// El nombre lo arma el backend, que conoce la zona del barrio
// (securepassb#198). Solo la forma que manda: filename="...", sin filename*.
export function fileNameFromDisposition(header: string | null): string | null {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}

// Fallback si el header no llega (CORS sin Expose-Headers, proxy): el CSV
// ya esta descargado, no se pierde por el nombre. Mismas fechas inclusivas
// que eligio el admin.
export function exportFileName(range: DateRange): string {
  return `access-logs-${range.from}-${range.to}.csv`;
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
      return { tone: "status", text: EXPORT_MESSAGES.done };
    case "busy":
      return { tone: "status", text: busyMessage(outcome.retryAfterSeconds) };
    case "invalidRange":
      return { tone: "alert", text: EXPORT_MESSAGES.invalidRange };
    case "error":
      return { tone: "alert", text: EXPORT_MESSAGES.error };
  }
}
