import type { components } from "@securepass/contracts";

import { formatInTz, TABLE_DATE_TIME } from "@/common/lib/datetime";
import { BACKEND_PAGE_SIZE } from "@/common/lib/pagination";
import type { ShiftPage, ShiftRow } from "@/modules/shifts/types";

// El orden viene del backend (mas recientes primero). Filas sin id o sin
// inicio no se pueden mostrar: se descartan en vez de romper la tabla. total
// y size salen del server, no de las filas que quedaron.
// Los `??` completan campos que el contrato marca opcionales aunque el
// backend siempre los manda; se van cuando sean required (#148).
export function toShiftPage(data: components["schemas"]["ShiftsResponse"]): ShiftPage {
  const rows = (data.items ?? []).flatMap((item): ShiftRow[] => {
    if (!item.id || !item.startedAt) return [];
    return [
      {
        id: item.id,
        gateName: item.gateName || "Sin garita",
        guardName: item.guardFullName || "Sin nombre",
        startedAt: item.startedAt,
        endedAt: item.endedAt ?? null,
        accessCount: item.accessCount ?? 0,
        handoverNotes: item.handoverNotes?.trim() ?? "",
      },
    ];
  });
  return { rows, total: data.total ?? 0, size: data.size ?? BACKEND_PAGE_SIZE };
}

// Un turno abierto dice "En curso": es el estado que el admin busca en el
// dia a dia, y una duracion parcial quedaria vieja entre refetches.
export function formatShiftEnd(endedAt: string | null, timeZone: string): string {
  if (endedAt === null) return "En curso";
  return formatInTz(endedAt, timeZone, TABLE_DATE_TIME);
}
