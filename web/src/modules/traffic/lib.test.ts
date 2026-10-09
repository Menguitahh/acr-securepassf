import { describe, expect, it } from "vitest";

import { checkRange } from "@/common/date-range/lib";
import { dayTicks, fillHourlyBuckets, summarize } from "@/modules/traffic/lib";

const MZA = "America/Argentina/Mendoza";

describe("fillHourlyBuckets", () => {
  const from = "2026-09-23T03:00:00.000Z";
  const to = "2026-09-24T03:00:00.000Z";

  it("completa las horas sin accesos con cero", () => {
    const points = fillHourlyBuckets(from, to, [
      { start: "2026-09-23T13:00:00Z", in: 5, out: 1 },
      { start: "2026-09-23T21:00:00Z", in: 2, out: 7 },
    ]);
    expect(points).toHaveLength(24);
    expect(points[0]).toEqual({ start: from, in: 0, out: 0 });
    expect(points[10]).toEqual({ start: "2026-09-23T13:00:00.000Z", in: 5, out: 1 });
    expect(points[18]).toEqual({ start: "2026-09-23T21:00:00.000Z", in: 2, out: 7 });
    expect(points.filter((point) => point.in + point.out > 0)).toHaveLength(2);
  });

  it("incluye el bucket del borde de inicio y excluye el de fin", () => {
    const points = fillHourlyBuckets(from, to, [
      { start: from, in: 1, out: 0 },
      { start: to, in: 9, out: 9 },
    ]);
    expect(points[0]?.in).toBe(1);
    expect(points.some((point) => point.in === 9)).toBe(false);
  });

  it("sin buckets devuelve todas las horas en cero", () => {
    const points = fillHourlyBuckets(from, to, []);
    expect(points).toHaveLength(24);
    expect(summarize(points)).toEqual({ totalIn: 0, totalOut: 0, peak: null });
  });
});

describe("summarize", () => {
  it("totales y hora pico de ingresos", () => {
    expect(
      summarize([
        { start: "a", in: 3, out: 1 },
        { start: "b", in: 8, out: 0 },
        { start: "c", in: 2, out: 6 },
      ]),
    ).toEqual({ totalIn: 13, totalOut: 7, peak: { start: "b", in: 8, out: 0 } });
  });
});

describe("dayTicks", () => {
  it("una marca por medianoche del barrio", () => {
    const points = fillHourlyBuckets("2026-09-21T03:00:00.000Z", "2026-09-24T03:00:00.000Z", []);
    expect(dayTicks(points, MZA)).toEqual([
      "2026-09-21T03:00:00.000Z",
      "2026-09-22T03:00:00.000Z",
      "2026-09-23T03:00:00.000Z",
    ]);
  });

  it("con 90 dias no pasa de 10 marcas", () => {
    const check = checkRange({ from: "2026-06-25", to: "2026-09-22" }, MZA);
    if (!check.ok) throw new Error(check.message);
    const points = fillHourlyBuckets(check.instants.from, check.instants.to, []);
    expect(dayTicks(points, MZA).length).toBeLessThanOrEqual(10);
  });
});
