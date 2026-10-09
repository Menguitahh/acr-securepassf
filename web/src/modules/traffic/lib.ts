import type { components } from "@securepass/contracts";

import { MAX_AXIS_TICKS } from "@/modules/traffic/data";
import type { TrafficPoint, TrafficSummary } from "@/modules/traffic/types";

const HOUR_MS = 3_600_000;

// El backend solo devuelve horas con accesos. Sin completar, una noche sin
// movimiento desaparece del eje y el grafico comprime el tiempo.
export function fillHourlyBuckets(
  from: string,
  to: string,
  buckets: components["schemas"]["Bucket"][],
): TrafficPoint[] {
  const byStart = new Map<number, { in: number; out: number }>();
  for (const bucket of buckets) {
    byStart.set(Date.parse(bucket.start), { in: bucket.in, out: bucket.out });
  }

  const points: TrafficPoint[] = [];
  const end = Date.parse(to);
  for (let t = Date.parse(from); t < end; t += HOUR_MS) {
    const counts = byStart.get(t) ?? { in: 0, out: 0 };
    points.push({ start: new Date(t).toISOString(), ...counts });
  }
  return points;
}

export function summarize(points: TrafficPoint[]): TrafficSummary {
  let totalIn = 0;
  let totalOut = 0;
  let peak: TrafficPoint | null = null;
  for (const point of points) {
    totalIn += point.in;
    totalOut += point.out;
    if (point.in > 0 && (!peak || point.in > peak.in)) peak = point;
  }
  return { totalIn, totalOut, peak };
}

// Una marca por dia, en la medianoche del barrio. Con rangos largos se
// saltean dias para no pasar de MAX_AXIS_TICKS.
export function dayTicks(points: TrafficPoint[], timeZone: string): string[] {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" });
  const midnights = points.filter((point) => hour.format(new Date(point.start)) === "00").map((point) => point.start);
  const step = Math.ceil(midnights.length / MAX_AXIS_TICKS);
  return midnights.filter((_, index) => index % step === 0);
}
