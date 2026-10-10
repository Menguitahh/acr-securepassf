import { describe, expect, it } from "vitest";

import {
  describeSuspension,
  liftSuspensionError,
  suspendedConflict,
  suspensionReviewError,
  validateSuspendReason,
  describePending,
  resendActivationError,
  parseCsv,
  toImportPreview,
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

describe("parseCsv (#214)", () => {
  it("detecta el separador y respeta comillas", () => {
    expect(parseCsv('codigo;calle\r\nA-1;"Los Robles; casa"\r\n')).toEqual([
      ["codigo", "calle"],
      ["A-1", "Los Robles; casa"],
    ]);
    expect(parseCsv('\uFEFFcodigo,calle\nA-2,"Dice ""hola"""\n\n')).toEqual([
      ["codigo", "calle"],
      ["A-2", 'Dice "hola"'],
    ]);
  });
});

describe("toImportPreview (#214)", () => {
  const header = "Código,calle,numero,titular_nombre,titular_dni,titular_email";

  it("marca errores por fila sin cortar las demas", () => {
    const csv = [
      header,
      "A-1,Los Robles,1,Ana Gomez,30111222,ana@ejemplo.com",
      ",Sin codigo,2,,,",
      "A-3,,,Solo Nombre,,",
      "A-4,,,Beto,123,beto@ejemplo.com",
      "a-1,repetido,,,,",
      "B-9,,,,,",
    ].join("\n");
    const out = toImportPreview(csv, new Set(["B-9"]));
    expect(out.kind).toBe("ok");
    if (out.kind !== "ok") return;
    expect(out.rows.map((r) => [r.line, r.status])).toEqual([
      [2, "ready"],
      [3, "invalid"],
      [4, "invalid"],
      [5, "invalid"],
      [6, "invalid"],
      [7, "ready"],
    ]);
    expect(out.rows[0]).toMatchObject({ row: { owner: { dni: "30111222" } }, lotExists: false });
    expect(out.rows[5]).toMatchObject({ lotExists: true, row: { owner: null } });
  });

  it("sin columna codigo o sin filas es error del archivo", () => {
    expect(toImportPreview("calle,numero\nx,1", new Set())).toMatchObject({ kind: "error" });
    expect(toImportPreview(header, new Set())).toMatchObject({ kind: "error" });
  });
});

describe("cuentas pendientes (US-54)", () => {
  it("describe rol y lotes; sin rol con lote es trabajador", () => {
    expect(describePending(["RESIDENT_OWNER"], ["A-1"])).toBe("Titular · A-1");
    expect(describePending([], ["A-1", "A-14"])).toBe("Trabajador · A-1, A-14");
    expect(describePending(["GUARD"], [])).toBe("Guardia");
  });

  it("errores del reenvio", () => {
    expect(resendActivationError(204)).toBeNull();
    expect(resendActivationError(429)).toMatch(/3 veces/);
  });
});

describe("suspension de personas (#121)", () => {
  const otro = { neighborhoodName: "Los Robles", reason: "Robo", suspendedAt: "2026-10-03T15:00:00Z", ownNeighborhood: false };

  it("describe quien, cuando y por que; sin datos si es anterior a #121", () => {
    expect(describeSuspension(otro)).toMatch(/^Suspendida por Los Robles el \d{1,2}\/10\/2026\. Motivo: Robo$/);
    expect(describeSuspension({ ...otro, ownNeighborhood: true })).toMatch(/^Suspendida por tu barrio/);
    expect(describeSuspension({ neighborhoodName: null, reason: null, suspendedAt: null, ownNeighborhood: true })).toBe(
      "Suspendida. No se registró qué barrio la suspendió.",
    );
  });

  it("el 409 USER_SUSPENDED de otro barrio permite pedir revision", () => {
    const body = { code: "USER_SUSPENDED", existingUserId: "u1", suspension: otro };
    expect(toSubmitOutcome(409, body, null)).toMatchObject({ kind: "suspended", userId: "u1", canRequestReview: true });
    expect(suspendedConflict(body)).toMatchObject({ message: expect.stringContaining("Motivo: Robo.") });
  });

  it("si la suspendio el propio barrio, manda a levantarla; sin datos no ofrece nada", () => {
    expect(
      suspendedConflict({ code: "USER_SUSPENDED", existingUserId: "u1", suspension: { ...otro, ownNeighborhood: true } }),
    ).toMatchObject({ canRequestReview: false, message: expect.stringContaining("Levantá la suspensión") });
    expect(suspendedConflict({ code: "USER_SUSPENDED", existingUserId: "u1" })).toMatchObject({ canRequestReview: false });
  });

  it("otro 409 sigue con el mensaje generico", () => {
    expect(suspendedConflict({ code: "EMAIL_TAKEN" })).toBeNull();
    expect(toSubmitOutcome(409, { code: "EMAIL_TAKEN", detail: "x" }, null)).toEqual({ kind: "error", message: "x" });
  });

  it("valida el motivo y traduce las respuestas", () => {
    expect(validateSuspendReason("  no ")).toMatch(/de 3 a 280/);
    expect(validateSuspendReason("x".repeat(281))).toMatch(/hasta 280/);
    expect(validateSuspendReason("Robo en el lote")).toBeNull();
    expect(liftSuspensionError(204)).toBeNull();
    expect(liftSuspensionError(409)).toMatch(/otro barrio/);
    expect(suspensionReviewError(202)).toBeNull();
    expect(suspensionReviewError(429)).toMatch(/24 horas/);
  });
});
