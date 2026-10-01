import { describe, expect, it } from "vitest";

import {
  busyMessage,
  exportFileName,
  exportNotice,
  fileNameFromDisposition,
  problemRule,
  retryAfterSeconds,
  unprocessableOutcome,
} from "@/modules/access-log/lib";

describe("fileNameFromDisposition", () => {
  it("lee el filename entre comillas que manda el backend", () => {
    expect(fileNameFromDisposition('attachment; filename="access-logs-2026-09-17-2026-09-23.csv"')).toBe(
      "access-logs-2026-09-17-2026-09-23.csv",
    );
  });

  it("sin header o sin filename devuelve null", () => {
    expect(fileNameFromDisposition(null)).toBeNull();
    expect(fileNameFromDisposition("attachment")).toBeNull();
    expect(fileNameFromDisposition('attachment; filename=""')).toBeNull();
  });
});

describe("exportFileName", () => {
  it("usa las fechas inclusivas que eligio el admin y la extension del formato", () => {
    const range = { from: "2026-09-17", to: "2026-09-23" };
    expect(exportFileName(range, "csv")).toBe("access-logs-2026-09-17-2026-09-23.csv");
    expect(exportFileName(range, "xlsx")).toBe("access-logs-2026-09-17-2026-09-23.xlsx");
  });
});

describe("problemRule", () => {
  it("lee rule del ProblemDetail", () => {
    expect(problemRule({ status: 422, rule: "export-rows" })).toBe("export-rows");
  });

  it("sin rule, rule no string o body que no es objeto devuelve null", () => {
    expect(problemRule({ status: 422 })).toBeNull();
    expect(problemRule({ status: 422, rule: 3 })).toBeNull();
    expect(problemRule("Unprocessable")).toBeNull();
    expect(problemRule(null)).toBeNull();
    expect(problemRule(undefined)).toBeNull();
  });
});

describe("unprocessableOutcome", () => {
  it("distingue rango invalido de exceso de filas por rule", () => {
    expect(unprocessableOutcome({ status: 422, rule: "export-range" })).toEqual({ kind: "invalidRange" });
    expect(unprocessableOutcome({ status: 422, rule: "export-rows" })).toEqual({ kind: "tooManyRows" });
  });

  it("un 422 sin rule conocido es error, no rango invalido", () => {
    expect(unprocessableOutcome({ status: 422, rule: "otra-regla" })).toEqual({ kind: "error" });
    expect(unprocessableOutcome({ status: 422 })).toEqual({ kind: "error" });
    expect(unprocessableOutcome(undefined)).toEqual({ kind: "error" });
  });
});

describe("retryAfterSeconds", () => {
  it("lee segundos enteros", () => {
    expect(retryAfterSeconds("30")).toBe(30);
    expect(retryAfterSeconds(" 5 ")).toBe(5);
  });

  it("sin header, fecha HTTP, cero o basura no inventa un numero", () => {
    expect(retryAfterSeconds(null)).toBeNull();
    expect(retryAfterSeconds("Wed, 23 Sep 2026 18:00:00 GMT")).toBeNull();
    expect(retryAfterSeconds("0")).toBeNull();
    expect(retryAfterSeconds("-3")).toBeNull();
  });
});

describe("busyMessage", () => {
  it("usa el valor del header", () => {
    expect(busyMessage(30)).toBe("Hay otra exportación en curso. Reintentá en 30 segundos.");
    expect(busyMessage(1)).toBe("Hay otra exportación en curso. Reintentá en 1 segundo.");
  });

  it("sin valor, generico", () => {
    expect(busyMessage(null)).toBe("Hay otra exportación en curso. Reintentá en unos segundos.");
  });
});

describe("exportNotice", () => {
  it("el 429 es aviso, no error", () => {
    expect(exportNotice({ kind: "busy", retryAfterSeconds: 30 }).tone).toBe("status");
    expect(exportNotice({ kind: "error" }).tone).toBe("alert");
    expect(exportNotice({ kind: "invalidRange" }).tone).toBe("alert");
  });

  it("el exceso de filas dice que hacer: acortar el rango o usar el CSV", () => {
    expect(exportNotice({ kind: "tooManyRows" })).toEqual({
      tone: "alert",
      text: "El rango supera el máximo de filas para Excel. Acortá el rango o exportá en CSV.",
    });
  });

  it("el aviso de exito usa la misma palabra que el boton", () => {
    const blob = new Blob([]);
    expect(exportNotice({ kind: "file", format: "csv", blob, fileName: "x.csv" }).text).toBe("CSV exportado.");
    expect(exportNotice({ kind: "file", format: "xlsx", blob, fileName: "x.xlsx" }).text).toBe("Exportado a Excel.");
  });
});
