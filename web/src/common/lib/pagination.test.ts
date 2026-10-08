import { describe, expect, it } from "vitest";

import { pageCount } from "@/common/lib/pagination";

describe("pageCount", () => {
  it("redondea para arriba: la ultima pagina puede venir incompleta", () => {
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(pageCount(27, 25)).toBe(2);
  });

  it("sin filas hay una pagina vacia, no cero", () => {
    expect(pageCount(0, 25)).toBe(1);
  });
});
