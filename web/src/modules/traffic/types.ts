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
