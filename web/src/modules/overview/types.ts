import type { components } from "@securepass/contracts";

// El union vive en EventResult.reason (mismos valores que el CHECK de
// access_logs.denial_reason). denialsByReason del overview viene tipado
// como Record<string, number>, por eso el tipo sale de aca.
export type DenialReason = NonNullable<components["schemas"]["EventResult"]["reason"]>;

export type DenialRow = {
  reason: string;
  label: string;
  count: number;
};

export type Overview = {
  date: string;
  currentOccupancy: number;
  allowedIn: number;
  allowedOut: number;
  denied: number;
  denials: DenialRow[];
};
