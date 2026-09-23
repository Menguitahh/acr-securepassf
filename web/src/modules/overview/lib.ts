import type { components } from "@securepass/contracts";

import { DENIAL_LABELS } from "@/modules/overview/data";
import type { DenialReason, DenialRow, Overview } from "@/modules/overview/types";

function isDenialReason(value: string): value is DenialReason {
  return Object.hasOwn(DENIAL_LABELS, value);
}

// Un motivo que el server manda y aca no esta mapeado no rompe la UI: se
// muestra crudo y queda un warning para agregarlo.
export function denialLabel(reason: string): string {
  if (isDenialReason(reason)) return DENIAL_LABELS[reason];
  console.warn(`Motivo de denegacion sin etiqueta: ${reason}`);
  return reason;
}

export function toDenialRows(byReason: Record<string, number>): DenialRow[] {
  return Object.entries(byReason)
    .map(([reason, count]) => ({ reason, label: denialLabel(reason), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

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
