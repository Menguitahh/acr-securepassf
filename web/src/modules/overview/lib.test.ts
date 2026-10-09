import { describe, expect, it } from "vitest";

import { toOverview } from "@/modules/overview/lib";

describe("toOverview", () => {
  it("campos ausentes del server quedan en cero, no en undefined", () => {
    expect(toOverview({ date: "2026-09-23" })).toEqual({
      date: "2026-09-23",
      currentOccupancy: 0,
      allowedIn: 0,
      allowedOut: 0,
      denied: 0,
      denials: [],
    });
  });
});
