import type { components } from "@securepass/contracts";

import { toDenialRows } from "@/common/denials/lib";
import type { Overview } from "@/modules/overview/types";

export function toOverview(response: components["schemas"]["OverviewResponse"]): Overview {
  return {
    date: response.date,
    currentOccupancy: response.currentOccupancy,
    allowedIn: response.allowedIn,
    allowedOut: response.allowedOut,
    denied: response.denied,
    denials: toDenialRows(response.denialsByReason),
  };
}
