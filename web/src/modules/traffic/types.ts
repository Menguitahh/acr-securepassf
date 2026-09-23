export type DateRange = {
  from: string;
  to: string;
};

export type InstantRange = {
  from: string;
  to: string;
};

export type RangeCheck = { ok: true; instants: InstantRange } | { ok: false; message: string };

export type TrafficPoint = {
  start: string;
  in: number;
  out: number;
};

export type TrafficSummary = {
  totalIn: number;
  totalOut: number;
  peak: TrafficPoint | null;
};
