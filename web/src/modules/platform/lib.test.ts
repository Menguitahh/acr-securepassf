import { describe, expect, it } from "vitest";

import { slugify, toCreateOutcome, validateNewNeighborhood } from "@/modules/platform/lib";

describe("alta de barrio (#229)", () => {
  it("arma el identificador desde el nombre", () => {
    expect(slugify("Los Álamos 2")).toBe("los-alamos-2");
    expect(slugify("  Barrio   Ñandú!  ")).toBe("barrio-nandu");
  });

  it("valida los datos del barrio y del admin", () => {
    const ok = {
      name: "Los Robles",
      slug: "los-robles",
      timezone: "America/Argentina/Mendoza",
      adminFullName: "Ana",
      adminDni: "30123456",
      adminEmail: "ana@robles.com",
    };
    expect(validateNewNeighborhood(ok)).toEqual({});
    expect(validateNewNeighborhood({ ...ok, slug: "Los Robles", adminDni: "12", adminEmail: "x" })).toEqual({
      slug: "Usá minúsculas, números y guiones.",
      adminDni: "El DNI va de 7 a 8 dígitos.",
      adminEmail: "Revisá el email del admin.",
    });
  });

  it("traduce la respuesta del backend", () => {
    expect(toCreateOutcome(201, null, "n1")).toEqual({ kind: "done", neighborhoodId: "n1" });
    expect(toCreateOutcome(409, { code: "SLUG_TAKEN" }, null)).toEqual({
      kind: "error",
      message: "Ya hay un barrio con ese identificador. Elegí otro.",
    });
    expect(toCreateOutcome(500, null, null).kind).toBe("error");
  });
});
