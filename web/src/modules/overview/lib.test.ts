import { describe, expect, it } from "vitest";

import { toOverview } from "@/modules/overview/lib";

describe("toOverview", () => {
  it("mapea los contadores tal como los manda el server", () => {
    expect(
      toOverview({
        date: "2026-09-23",
        currentOccupancy: 6,
        allowedIn: 7,
        allowedOut: 1,
        denied: 0,
        denialsByReason: {},
      }),
    ).toEqual({
      date: "2026-09-23",
      currentOccupancy: 6,
      allowedIn: 7,
      allowedOut: 1,
      denied: 0,
      denials: [],
    });
  });
});
