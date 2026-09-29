import type { components } from "@securepass/contracts";

import { checkRange, todayIn } from "@/common/date-range/lib";
import { BACKEND_PAGE_SIZE } from "@/common/lib/pagination";
import { DAY_ERRORS, DIRECTION_LABELS, SUBJECT_TYPE_LABELS } from "@/modules/denied/data";
import type { DayCheck, DeniedLogPage, DeniedLogRow } from "@/modules/denied/types";

// El conteo por motivo (overview?date=) y el drill-down (access-logs) tienen
// que mirar la misma ventana, o el grupo dice 12 y la lista muestra 13. Los
// dos filtran captured_at en [medianoche del barrio, medianoche siguiente):
// es exactamente el rango de un dia de checkRange.
export function checkDay(date: string, timeZone: string, now: Date): DayCheck {
  const check = checkRange({ from: date, to: date }, timeZone);
  if (!check.ok) return { ok: false, message: DAY_ERRORS.missing };
  // YYYY-MM-DD compara como texto en orden cronologico.
  if (date > todayIn(timeZone, now)) return { ok: false, message: DAY_ERRORS.future };
  return { ok: true, ...check.instants };
}

// Filas sin id o sin hora se descartan en vez de romper la tabla; total y
// size salen del server, no de las filas que quedaron.
// Los `??` completan campos que el contrato marca opcionales aunque el
// backend siempre los manda; se van cuando sean required (#148).
export function toDeniedLogPage(data: components["schemas"]["AccessLogsResponse"]): DeniedLogPage {
  const rows = (data.items ?? []).flatMap((item): DeniedLogRow[] => {
    if (!item.id || !item.capturedAt) return [];
    return [
      {
        id: item.id,
        capturedAt: item.capturedAt,
        subjectName: item.subjectName || "Sin nombre",
        subjectDocument: item.subjectDocument || "Sin documento",
        lotCode: item.lotCode || "Sin lote",
        subjectType: SUBJECT_TYPE_LABELS[item.subjectType ?? ""] ?? item.subjectType ?? "Sin tipo",
        direction: DIRECTION_LABELS[item.direction ?? ""] ?? item.direction ?? "Sin sentido",
      },
    ];
  });
  return { rows, total: data.total ?? 0, size: data.size ?? BACKEND_PAGE_SIZE };
}
