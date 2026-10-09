import { describe, expect, it } from "vitest";

import { formatInTz, formatLocalDate, isValidTimeZone } from "@/common/lib/datetime";

const TIME = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;

describe("formatInTz", () => {
  it("muestra el instante en la hora del barrio, no en UTC", () => {
    expect(formatInTz("2026-09-23T01:30:00Z", "America/Argentina/Mendoza", TIME)).toBe("22:30");
  });

  it("respeta el dia del barrio cuando en UTC ya es el siguiente", () => {
    expect(
      formatInTz("2026-09-23T01:30:00Z", "America/Argentina/Mendoza", { day: "numeric", month: "numeric" }),
    ).toBe("22/9");
  });

  it("aplica horario de verano segun la fecha", () => {
    // New York: UTC-4 en julio, UTC-5 en enero.
    expect(formatInTz("2026-07-01T16:00:00Z", "America/New_York", TIME)).toBe("12:00");
    expect(formatInTz("2026-01-15T16:00:00Z", "America/New_York", TIME)).toBe("11:00");
  });

  it("un valor invalido muestra un guion sin tirar", () => {
    expect(formatInTz("no es fecha", "America/Argentina/Mendoza", TIME)).toBe("—");
  });
});

describe("formatLocalDate", () => {
  it("no corre la fecha civil un dia para atras", () => {
    expect(formatLocalDate("2026-09-23")).toBe("23 de septiembre");
  });

  it("rechaza lo que no es YYYY-MM-DD", () => {
    expect(formatLocalDate("23/09/2026")).toBe("—");
    expect(formatLocalDate("2026-13-45")).toBe("—");
  });
});

describe("isValidTimeZone", () => {
  it("acepta IANA y rechaza basura", () => {
    expect(isValidTimeZone("America/Argentina/Mendoza")).toBe(true);
    expect(isValidTimeZone("Marte/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
