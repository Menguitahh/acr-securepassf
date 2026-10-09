import type { components } from "@securepass/contracts";

import { toDenialRows } from "@/common/denials/lib";
import type { Overview } from "@/modules/overview/types";

export function toOverview(response: components["schemas"]["OverviewResponse"]): Overview {
  return {
    date: response.date ?? "",
    currentOccupancy: response.currentOccupancy ?? 0,
    allowedIn: response.allowedIn ?? 0,
    allowedOut: response.allowedOut ?? 0,
    denied: response.denied ?? 0,
    denials: toDenialRows(response.denialsByReason ?? {}),
  };
}
