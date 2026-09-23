"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatInTz } from "@/common/lib/datetime";
import { DAY_LABEL, HOUR_LABEL } from "@/modules/traffic/data";
import { dayTicks, summarize } from "@/modules/traffic/lib";
import type { TrafficPoint } from "@/modules/traffic/types";

interface Props {
  points: TrafficPoint[];
  timeZone: string;
}

const AXIS_TICK = { fill: "var(--color-text-muted)", fontSize: 12 };

// Monocromatico (spec 9.1: el color es solo del resultado de escaneo).
// Agrupadas, no apiladas: ingresos y egresos no se suman.
export function TrafficChart({ points, timeZone }: Props) {
  const { totalIn, totalOut, peak } = summarize(points);
  const peakText = peak
    ? ` Hora pico de ingresos: ${formatInTz(peak.start, timeZone, HOUR_LABEL)}, con ${peak.in}.`
    : "";
  const description = `${totalIn} ingresos y ${totalOut} egresos en el rango.${peakText}`;

  return (
    <figure className="flex flex-col gap-3 rounded-lg border border-border bg-bg-surface p-5">
      <figcaption className="text-sm text-text-muted">{description}</figcaption>
      <div role="img" aria-label={`Gráfico de barras por hora. ${description}`} className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} barGap={0} barCategoryGap="10%">
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="start"
              ticks={dayTicks(points, timeZone)}
              tickFormatter={(value: string) => formatInTz(value, timeZone, DAY_LABEL)}
              stroke="var(--color-text-muted)"
              tick={AXIS_TICK}
            />
            <YAxis allowDecimals={false} width={40} stroke="var(--color-text-muted)" tick={AXIS_TICK} />
            <Tooltip
              cursor={{ fill: "var(--color-bg-elevated)" }}
              labelFormatter={(value) => (typeof value === "string" ? formatInTz(value, timeZone, HOUR_LABEL) : "")}
              contentStyle={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
              }}
              labelStyle={{ color: "var(--color-text-primary)" }}
              itemStyle={{ color: "var(--color-text-primary)" }}
            />
            <Legend wrapperStyle={{ color: "var(--color-text-muted)", fontSize: 12 }} />
            <Bar dataKey="in" name="Ingresos" fill="var(--color-text-primary)" isAnimationActive={false} />
            <Bar dataKey="out" name="Egresos" fill="var(--color-text-muted)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
