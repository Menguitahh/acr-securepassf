import type { components } from "@securepass/contracts";
import { createColumnHelper, type TableOptions } from "@tanstack/react-table";

import { formatInTz, TABLE_DATE_TIME } from "@/common/lib/datetime";
import { INITIAL_SORTING, OVERSTAY_FEATURES } from "@/modules/overstays/data";
import type { OverstayRow } from "@/modules/overstays/types";

const column = createColumnHelper<typeof OVERSTAY_FEATURES, OverstayRow>();

// "3h 24min", no "204 minutos" ni "3.4 horas". Queda en horas aunque pase
// de un dia: la spec habla de horas transcurridas.
export function formatDurationEs(minutes: number): string {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}min`;
}

// Filas sin id o sin fecha de entrada no se pueden mostrar ni ordenar: se
// descartan en vez de romper la tabla.
export function toOverstayRows(items: components["schemas"]["Overstay"][]): OverstayRow[] {
  return items.flatMap((item) => {
    if (!item.stayId || !item.enteredAt) return [];
    return [
      {
        stayId: item.stayId,
        lotCode: item.lotCode || "Sin lote",
        subjectName: item.subjectName || "Sin nombre",
        enteredAt: item.enteredAt,
        expectedUntil: item.expectedUntil ?? "",
        minutesElapsed: item.minutesElapsed ?? 0,
      },
    ];
  });
}

// Opciones de la tabla sin React: las usa el componente (useTable) y el
// test (constructTable), asi el test verifica exactamente lo que se ve.
export function overstayTableOptions(
  rows: OverstayRow[],
  timeZone: string,
): TableOptions<typeof OVERSTAY_FEATURES, OverstayRow> {
  return {
    features: OVERSTAY_FEATURES,
    data: rows,
    enableSortingRemoval: false,
    initialState: { sorting: INITIAL_SORTING },
    columns: column.columns([
      column.accessor("lotCode", { header: "Lote", sortFn: "text" }),
      column.accessor("subjectName", { header: "Invitado", sortFn: "text" }),
      // ISO en UTC: el orden de texto es el orden cronologico.
      column.accessor("enteredAt", {
        header: "Entró",
        sortFn: "text",
        cell: (info) => formatInTz(info.getValue(), timeZone, TABLE_DATE_TIME),
      }),
      column.accessor("minutesElapsed", {
        header: "Tiempo adentro",
        sortDescFirst: true,
        cell: (info) => formatDurationEs(info.getValue()),
      }),
      column.accessor("expectedUntil", {
        header: "Esperado hasta",
        sortFn: "text",
        cell: (info) => formatInTz(info.getValue(), timeZone, TABLE_DATE_TIME),
      }),
    ]),
  };
}
