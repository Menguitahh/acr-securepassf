import { describe, expect, it } from "vitest";

import { RANGE_ERRORS } from "@/modules/traffic/data";
import {
  checkRange,
  dayTicks,
  defaultRange,
  fillHourlyBuckets,
  summarize,
  zonedMidnight,
} from "@/modules/traffic/lib";

const MZA = "America/Argentina/Mendoza";

describe("zonedMidnight", () => {
  it("medianoche en Mendoza es 03:00Z", () => {
    expect(zonedMidnight("2026-09-23", MZA)).toBe("2026-09-23T03:00:00.000Z");
  });

  it("usa el offset de cada fecha en una zona con horario de verano", () => {
    // New York: UTC-4 en verano, UTC-5 en invierno.
    expect(zonedMidnight("2026-07-01", "America/New_York")).toBe("2026-07-01T04:00:00.000Z");
    expect(zonedMidnight("2026-01-15", "America/New_York")).toBe("2026-01-15T05:00:00.000Z");
  });

  it("el dia del cambio de horario toma el offset de esa medianoche", () => {
    // 8/3/2026: New York pasa a UTC-4 a las 02:00; la medianoche todavia es UTC-5.
    expect(zonedMidnight("2026-03-08", "America/New_York")).toBe("2026-03-08T05:00:00.000Z");
    // Santiago de Chile: el 6/9/2026 la medianoche no existe (00:00 -> 01:00).
    expect(zonedMidnight("2026-09-06", "America/Santiago")).toBe("2026-09-06T04:00:00.000Z");
  });
});

describe("defaultRange", () => {
  it("ultimos 7 dias incluyendo hoy, en el dia del barrio", () => {
    // 02:00Z del 24 todavia es el 23 en Mendoza.
    expect(defaultRange(MZA, new Date("2026-09-24T02:00:00Z"))).toEqual({ from: "2026-09-17", to: "2026-09-23" });
  });
});

describe("checkRange", () => {
  it("fin inclusivo: termina en la medianoche del dia siguiente", () => {
    expect(checkRange({ from: "2026-09-17", to: "2026-09-23" }, MZA)).toEqual({
      ok: true,
      instants: { from: "2026-09-17T03:00:00.000Z", to: "2026-09-24T03:00:00.000Z" },
    });
  });

  it("un solo dia es valido", () => {
    expect(checkRange({ from: "2026-09-23", to: "2026-09-23" }, MZA).ok).toBe(true);
  });

  it("rechaza fechas vacias, invertidas o mas de 90 dias", () => {
    expect(checkRange({ from: "", to: "2026-09-23" }, MZA)).toEqual({ ok: false, message: RANGE_ERRORS.missing });
    expect(checkRange({ from: "2026-09-23", to: "2026-09-22" }, MZA)).toEqual({ ok: false, message: RANGE_ERRORS.inverted });
    expect(checkRange({ from: "2026-06-25", to: "2026-09-22" }, MZA).ok).toBe(true);
    expect(checkRange({ from: "2026-06-24", to: "2026-09-22" }, MZA)).toEqual({ ok: false, message: RANGE_ERRORS.tooLong });
  });
});

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
