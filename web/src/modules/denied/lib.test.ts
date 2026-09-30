import { describe, expect, it } from "vitest";

import { DAY_ERRORS } from "@/modules/denied/data";
import { checkDay, passLabel, toDeniedLogPage } from "@/modules/denied/lib";

const MZA = "America/Argentina/Mendoza";
// 2026-09-29 10:00 en Mendoza.
const NOW = new Date("2026-09-29T13:00:00Z");

describe("checkDay", () => {
  it("un dia es [medianoche del barrio, medianoche siguiente), la ventana del overview", () => {
    expect(checkDay("2026-09-23", MZA, NOW)).toEqual({
      ok: true,
      from: "2026-09-23T03:00:00.000Z",
      to: "2026-09-24T03:00:00.000Z",
    });
  });

  it("hoy en la zona del barrio es valido aunque en UTC ya sea manana", () => {
    // 22:30 en Mendoza = 01:30 UTC del dia siguiente.
    expect(checkDay("2026-09-29", MZA, new Date("2026-09-30T01:30:00Z")).ok).toBe(true);
  });

  it("un dia futuro no se consulta", () => {
    expect(checkDay("2026-09-30", MZA, NOW)).toEqual({ ok: false, message: DAY_ERRORS.future });
  });

  it("dia vacio o mal formado no se consulta", () => {
    expect(checkDay("", MZA, NOW)).toEqual({ ok: false, message: DAY_ERRORS.missing });
    expect(checkDay("2026-9-3", MZA, NOW)).toEqual({ ok: false, message: DAY_ERRORS.missing });
  });
});

describe("toDeniedLogPage", () => {
  it("mapea etiquetas y toma total y size del server", () => {
    const page = toDeniedLogPage({
      items: [
        {
          id: "l1",
          capturedAt: "2026-09-23T13:00:00Z",
          passHolderName: "Juan Gómez",
          subjectDocument: "30111222",
          lotCode: "M4-L12",
          subjectType: "GUEST",
          direction: "IN",
          result: "DENIED",
          denialReason: "DOCUMENT_MISMATCH",
        },
      ],
      page: 0,
      size: 25,
      total: 40,
    });
    expect(page).toEqual({
      rows: [
        {
          id: "l1",
          capturedAt: "2026-09-23T13:00:00Z",
          pass: "Pase de: Juan Gómez",
          subjectDocument: "30111222",
          lotCode: "M4-L12",
          subjectType: "Invitado",
          direction: "Ingreso",
        },
      ],
      total: 40,
      size: 25,
    });
  });

  it("descarta filas sin id o sin hora, pero el total sigue siendo el del server", () => {
    const page = toDeniedLogPage({ items: [{ id: "x" }, { capturedAt: "2026-09-23T13:00:00Z" }], total: 2, size: 25 });
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(2);
  });

  it("campos faltantes tienen respaldo y un tipo desconocido se muestra crudo", () => {
    const [row] = toDeniedLogPage({
      items: [{ id: "l1", capturedAt: "2026-09-23T13:00:00Z", subjectType: "DELIVERY" }],
    }).rows;
    expect(row).toMatchObject({
      pass: "Pase sin registrar",
      subjectDocument: "",
      lotCode: "",
      subjectType: "DELIVERY",
      direction: "Sin sentido",
    });
  });
});

describe("passLabel", () => {
  it("con titular muestra de quien es el pase, sea cual sea el motivo", () => {
    expect(passLabel("Ana Ruiz", "EXPIRED")).toBe("Pase de: Ana Ruiz");
    expect(passLabel("Ana Ruiz", "UNKNOWN")).toBe("Pase de: Ana Ruiz");
  });

  it("sin titular, firma invalida o pase inexistente no se pueden atribuir", () => {
    expect(passLabel(undefined, "INVALID_SIGNATURE")).toBe("No identificable");
    expect(passLabel(undefined, "UNKNOWN")).toBe("No identificable");
  });

  it("sin titular y con otro motivo es una fila anterior al vinculo, no una no identificable", () => {
    expect(passLabel(undefined, "NOT_YET_VALID")).toBe("Pase sin registrar");
    expect(passLabel(undefined, "REPLAY")).toBe("Pase sin registrar");
    expect(passLabel("", "EXPIRED")).toBe("Pase sin registrar");
    expect(passLabel(undefined, undefined)).toBe("Pase sin registrar");
  });
});
