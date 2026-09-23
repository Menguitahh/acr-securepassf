import { constructTable } from "@tanstack/react-table";
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings";
import { describe, expect, it } from "vitest";

import { formatDurationEs, overstayTableOptions, toOverstayRows } from "@/modules/overstays/lib";
import type { OverstayRow } from "@/modules/overstays/types";

// Fuera de React, v9 necesita el binding de reactividad que useTable pone solo.
function buildTable(rows: OverstayRow[], timeZone: string) {
  const options = overstayTableOptions(rows, timeZone);
  const features = { ...options.features, coreReactivityFeature: storeReactivityBindings() };
  return constructTable({ ...options, features });
}

const MZA = "America/Argentina/Mendoza";

const row = (stayId: string, subjectName: string, minutesElapsed: number): OverstayRow => ({
  stayId,
  lotCode: "M4-L12",
  subjectName,
  enteredAt: "2026-09-23T13:00:00Z",
  expectedUntil: "2026-09-23T21:00:00Z",
  minutesElapsed,
});

describe("formatDurationEs", () => {
  it.each([
    [0, "0min"],
    [45, "45min"],
    [60, "1h"],
    [204, "3h 24min"],
    [480, "8h"],
    [1500, "25h"],
  ])("%i minutos -> %s", (minutes, expected) => {
    expect(formatDurationEs(minutes)).toBe(expected);
  });

  it("negativos, decimales y no numeros no rompen", () => {
    expect(formatDurationEs(-5)).toBe("0min");
    expect(formatDurationEs(204.9)).toBe("3h 24min");
    expect(formatDurationEs(Number.NaN)).toBe("0min");
  });
});

describe("toOverstayRows", () => {
  it("completa faltantes y descarta filas sin id o sin entrada", () => {
    expect(
      toOverstayRows([
        { stayId: "s1", enteredAt: "2026-09-23T10:00:00Z", minutesElapsed: 540, lotCode: "", subjectName: "Ana" },
        { stayId: "s2" },
        { enteredAt: "2026-09-23T10:00:00Z" },
      ]),
    ).toEqual([
      {
        stayId: "s1",
        lotCode: "Sin lote",
        subjectName: "Ana",
        enteredAt: "2026-09-23T10:00:00Z",
        expectedUntil: "",
        minutesElapsed: 540,
      },
    ]);
  });
});

describe("overstayTableOptions", () => {
  const rows = [row("s1", "Ana", 500), row("s2", "Beto", 1500), row("s3", "Caro", 204)];

  it("ordena por tiempo adentro desc por default", () => {
    const table = buildTable(rows, MZA);
    expect(table.getRowModel().rows.map((r) => r.original.subjectName)).toEqual(["Beto", "Ana", "Caro"]);
  });

  it("ordenar por otra columna reemplaza el default", () => {
    const table = buildTable(rows, MZA);
    table.setSorting([{ id: "subjectName", desc: false }]);
    expect(table.getRowModel().rows.map((r) => r.original.subjectName)).toEqual(["Ana", "Beto", "Caro"]);
  });

  it("las celdas muestran duracion y horas en la zona del barrio", () => {
    const table = buildTable([row("s1", "Ana", 204)], MZA);
    const cells = table.getRowModel().rows[0]?.getAllCells() ?? [];
    const rendered = cells.map((cell) => {
      const render = cell.column.columnDef.cell;
      return typeof render === "function" ? render(cell.getContext()) : cell.getValue();
    });
    // 13:00Z es 10:00 en Mendoza; 21:00Z es 18:00.
    expect(rendered).toEqual(["M4-L12", "Ana", "mié, 23 sept, 10:00", "3h 24min", "mié, 23 sept, 18:00"]);
  });
});
