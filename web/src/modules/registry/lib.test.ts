import { describe, expect, it } from "vitest";

import {
  formatAddress,
  statusAction,
  toLotRows,
  toSubmitOutcome,
  validateLot,
  validateOnboard,
} from "@/modules/registry/lib";

describe("toLotRows", () => {
  it("arma la direccion; calle y numero null quedan vacios", () => {
    const meta = { neighborhoodId: "n", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" };
    const rows = toLotRows([
      { ...meta, id: "1", code: "A-001", street: "Los Alamos", number: "12", status: "ACTIVE" },
      { ...meta, id: "2", code: "A-002", street: null, number: null, status: "VACANT" },
    ]);
    expect(rows).toEqual([
      { id: "1", code: "A-001", address: "Los Alamos 12", status: "ACTIVE" },
      { id: "2", code: "A-002", address: "", status: "VACANT" },
    ]);
  });

  it("formatAddress ignora partes vacias", () => {
    expect(formatAddress("  ", "5")).toBe("5");
    expect(formatAddress(null, null)).toBe("");
  });
});

describe("statusAction", () => {
  it("activo se suspende, suspendido se reactiva, vacante no tiene accion", () => {
    expect(statusAction("ACTIVE")).toMatchObject({ kind: "suspend", next: "SUSPENDED" });
    expect(statusAction("SUSPENDED")).toMatchObject({ kind: "reactivate", next: "ACTIVE" });
    expect(statusAction("VACANT")).toEqual({ kind: "none" });
  });
});

describe("validacion", () => {
  it("lote sin codigo", () => {
    expect(validateLot({ code: " ", street: "", number: "" })).toHaveProperty("code");
    expect(validateLot({ code: "A-9", street: "", number: "" })).toEqual({});
  });

  it("alta: nombre, DNI de 7 u 8 numeros y email", () => {
    expect(validateOnboard({ fullName: "", dni: "12.345.678", email: "x" })).toEqual({
      fullName: expect.any(String),
      dni: expect.any(String),
      email: expect.any(String),
    });
    expect(validateOnboard({ fullName: "Ana", dni: "12345678", email: "ana@test.com" })).toEqual({});
  });
});

describe("toSubmitOutcome", () => {
  it("2xx es done", () => {
    expect(toSubmitOutcome(200, {}, null)).toEqual({ kind: "done" });
  });

  it("400 con errores por campo los asigna al campo", () => {
    const outcome = toSubmitOutcome(400, { errors: [{ field: "dni", message: "dni de 7 u 8 digitos" }] }, null);
    expect(outcome).toEqual({ kind: "invalid", fields: { dni: expect.stringContaining("DNI") } });
  });

  it("409 usa el mensaje propio, o el detail del server si no hay", () => {
    expect(toSubmitOutcome(409, { detail: "ya existe" }, "Ya hay un lote con ese código.")).toEqual({
      kind: "error",
      message: "Ya hay un lote con ese código.",
    });
    expect(toSubmitOutcome(409, { detail: "El usuario esta suspendido" }, null)).toEqual({
      kind: "error",
      message: "El usuario esta suspendido",
    });
  });

  it("5xx o red: error generico accionable", () => {
    expect(toSubmitOutcome(500, null, null)).toMatchObject({ kind: "error" });
  });
});
