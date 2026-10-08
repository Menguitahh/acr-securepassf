import type { DenialRow } from "@/common/denials/types";

export type Overview = {
  date: string;
  currentOccupancy: number;
  allowedIn: number;
  allowedOut: number;
  denied: number;
  denials: DenialRow[];
};
