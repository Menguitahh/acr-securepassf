import { describe, expect, it } from "vitest";

import {
  busyMessage,
  exportFileName,
  exportNotice,
  fileNameFromDisposition,
  retryAfterSeconds,
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
  it("usa las fechas inclusivas que eligio el admin", () => {
    expect(exportFileName({ from: "2026-09-17", to: "2026-09-23" })).toBe("access-logs-2026-09-17-2026-09-23.csv");
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
    expect(exportNotice({ kind: "file", blob: new Blob([]), fileName: "x.csv" })).toEqual({
      tone: "status",
      text: "CSV exportado.",
    });
  });
});
