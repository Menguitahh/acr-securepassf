import type { components } from "@securepass/contracts";

export type NeighborhoodOverview = components["schemas"]["NeighborhoodOverviewResponse"];

export type NewNeighborhoodInput = {
  name: string;
  slug: string;
  timezone: string;
  adminFullName: string;
  adminDni: string;
  adminEmail: string;
};

export type NewNeighborhoodErrors = Partial<Record<keyof NewNeighborhoodInput, string>>;

export type CreateOutcome = { kind: "done"; neighborhoodId: string } | { kind: "error"; message: string };
