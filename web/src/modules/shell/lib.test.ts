import { describe, expect, it } from "vitest";

import { isActiveRoute } from "@/modules/shell/lib";

describe("isActiveRoute", () => {
  it("activa / solo en / exacto", () => {
    expect(isActiveRoute("/", "/")).toBe(true);
    expect(isActiveRoute("/turnos", "/")).toBe(false);
  });

  it("activa una seccion en su ruta y sus subrutas", () => {
    expect(isActiveRoute("/turnos", "/turnos")).toBe(true);
    expect(isActiveRoute("/turnos/123", "/turnos")).toBe(true);
  });

  it("no activa por prefijo sin separador", () => {
    expect(isActiveRoute("/turnos-archivados", "/turnos")).toBe(false);
  });

  it("no activa otras secciones", () => {
    expect(isActiveRoute("/denegados", "/turnos")).toBe(false);
  });
});
