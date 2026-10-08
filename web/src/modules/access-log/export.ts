import { api } from "@/common/api/client";
import type { DateRange, InstantRange } from "@/common/date-range/types";
import { EXPORT_FORMATS } from "@/modules/access-log/data";
import {
  exportFileName,
  fileNameFromDisposition,
  retryAfterSeconds,
  unprocessableOutcome,
} from "@/modules/access-log/lib";
import type { ExportFormat, ExportOutcome, ResultFilter } from "@/modules/access-log/types";

// Por api (y no un <a href>): la descarga necesita el Bearer y el refresh
// de #126. parseAs blob: la respuesta es un archivo (csv o xlsx), no JSON.
export async function requestExport(
  format: ExportFormat,
  range: DateRange,
  instants: InstantRange,
  result: ResultFilter,
): Promise<ExportOutcome> {
  let answer;
  try {
    answer = await api.GET(EXPORT_FORMATS[format].path, {
      params: {
        query: { from: instants.from, to: instants.to, ...(result === "ALL" ? {} : { result }) },
      },
      parseAs: "blob",
    });
  } catch {
    // Red caida, o el navegador no pudo armar el blob (memoria): error claro
    // en vez de una pantalla trabada en "Exportando".
    return { kind: "error" };
  }

  const { data, error, response } = answer;
  if (response.status === 429) {
    return { kind: "busy", retryAfterSeconds: retryAfterSeconds(response.headers.get("Retry-After")) };
  }
  if (response.status === 422) return unprocessableOutcome(error);
  if (!response.ok || !(data instanceof Blob)) return { kind: "error" };
  const fileName =
    fileNameFromDisposition(response.headers.get("Content-Disposition")) ?? exportFileName(range, format);
  return { kind: "file", format, blob: data, fileName };
}

// ponytail: el archivo entero pasa por memoria como blob antes de guardarse.
// 90 dias a 5.000 eventos/dia son ~38 MB (securepassb#190), holgado para un
// navegador. Si crece mucho mas: guardar en streaming con File System
// Access API donde exista.
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Diferido: revocar en el mismo tick puede cortar la descarga en Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
