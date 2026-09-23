import { afterEach, describe, expect, it, vi } from "vitest";

import { denialLabel, toDenialRows, toOverview } from "@/modules/overview/lib";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("denialLabel", () => {
  it("traduce un motivo conocido", () => {
    expect(denialLabel("REPLAY")).toBe("Pase usado dos veces");
  });

  it("un motivo sin mapear se muestra crudo y avisa por consola", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(denialLabel("NEW_REASON")).toBe("NEW_REASON");
    expect(warn).toHaveBeenCalledWith("Motivo de denegacion sin etiqueta: NEW_REASON");
  });

  it("no confunde propiedades del prototipo con motivos", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(denialLabel("toString")).toBe("toString");
  });
});

describe("toDenialRows", () => {
  it("ordena por cantidad desc y desempata por etiqueta", () => {
    const rows = toDenialRows({ EXPIRED: 3, ALREADY_USED: 12, REVOKED: 3 });
    expect(rows.map((row) => row.label)).toEqual(["Pase ya usado", "Pase revocado", "Pase vencido"]);
    expect(rows.map((row) => row.count)).toEqual([12, 3, 3]);
  });

  it("sin denegados devuelve lista vacia", () => {
    expect(toDenialRows({})).toEqual([]);
  });
});

describe("toOverview", () => {
  it("campos ausentes del server quedan en cero, no en undefined", () => {
    expect(toOverview({ date: "2026-09-23" })).toEqual({
      date: "2026-09-23",
      currentOccupancy: 0,
      allowedIn: 0,
      allowedOut: 0,
      denied: 0,
      denials: [],
    });
  });
});
