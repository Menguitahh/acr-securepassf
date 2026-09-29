import { describe, expect, it } from "vitest";

import { BACKEND_PAGE_SIZE } from "@/common/lib/pagination";
import { formatShiftEnd, toShiftPage } from "@/modules/shifts/lib";

const MZA = "America/Argentina/Mendoza";

const item = (id: string) => ({
  id,
  gateName: "Garita norte",
  guardFullName: "Ana Pérez",
  startedAt: "2026-09-23T09:00:00Z",
  endedAt: "2026-09-23T17:00:00Z",
  handoverNotes: "Sin novedades",
  accessCount: 42,
});

describe("toShiftPage", () => {
  it("mapea un turno cerrado", () => {
    expect(toShiftPage({ items: [item("s1")], page: 0, size: 25, total: 1 }).rows).toEqual([
      {
        id: "s1",
        gateName: "Garita norte",
        guardName: "Ana Pérez",
        startedAt: "2026-09-23T09:00:00Z",
        endedAt: "2026-09-23T17:00:00Z",
        accessCount: 42,
        handoverNotes: "Sin novedades",
      },
    ]);
  });

  it("turno abierto queda con endedAt null y campos faltantes con respaldo", () => {
    const [row] = toShiftPage({ items: [{ id: "s1", startedAt: "2026-09-23T09:00:00Z" }] }).rows;
    expect(row).toEqual({
      id: "s1",
      gateName: "Sin garita",
      guardName: "Sin nombre",
      startedAt: "2026-09-23T09:00:00Z",
      endedAt: null,
      accessCount: 0,
      handoverNotes: "",
    });
  });

  it("descarta filas sin id o sin inicio y conserva el orden del server", () => {
    const { rows } = toShiftPage({ items: [item("b"), { startedAt: "2026-09-23T09:00:00Z" }, { id: "x" }, item("a")] });
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("total y size salen del server, no de las filas que quedaron", () => {
    const page = toShiftPage({ items: [item("a"), { id: "sin-inicio" }], page: 1, size: 25, total: 27 });
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(27);
    expect(page.size).toBe(25);
  });

  it("respuesta sin items, total ni size: pagina vacia del tamano del backend", () => {
    expect(toShiftPage({})).toEqual({ rows: [], total: 0, size: BACKEND_PAGE_SIZE });
  });
});

describe("formatShiftEnd", () => {
  it("turno abierto dice En curso", () => {
    expect(formatShiftEnd(null, MZA)).toBe("En curso");
  });

  it("turno cerrado muestra la hora del barrio", () => {
    expect(formatShiftEnd("2026-09-23T17:00:00Z", MZA)).toContain("14:00");
  });
});
