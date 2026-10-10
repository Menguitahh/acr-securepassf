"use client";

import { useState } from "react";

import { EmptyState } from "@/common/components/empty-state";
import { ErrorState } from "@/common/components/error-state";
import { LoadingState } from "@/common/components/loading-state";
import { RangeForm } from "@/common/components/range-form";
import { checkRange, defaultRange } from "@/common/date-range/lib";
import type { DateRange } from "@/common/date-range/types";
import { useNeighborhoodTimeZone } from "@/modules/auth/hooks";
import { TrafficChart } from "@/modules/traffic/components/traffic-chart";
import { useTraffic } from "@/modules/traffic/hooks";
import { summarize } from "@/modules/traffic/lib";

export function TrafficView() {
  const timeZone = useNeighborhoodTimeZone();
  // AdminGuard solo renderiza esto dentro de un barrio; el chequeo angosta el tipo.
  if (!timeZone) return null;
  return <Traffic timeZone={timeZone} />;
}

interface TrafficProps {
  timeZone: string;
}

function Traffic({ timeZone }: TrafficProps) {
  const [range, setRange] = useState<DateRange>(() => defaultRange(timeZone, new Date()));
  const check = checkRange(range, timeZone);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Afluencia</h1>
        <p className="text-sm text-text-muted">Ingresos y egresos permitidos por hora, en el horario del barrio</p>
      </header>
      <RangeForm range={range} error={check.ok ? null : check.message} onChange={setRange} />
      {check.ok && <TrafficResult from={check.instants.from} to={check.instants.to} timeZone={timeZone} />}
    </div>
  );
}

interface ResultProps {
  from: string;
  to: string;
  timeZone: string;
}

function TrafficResult({ from, to, timeZone }: ResultProps) {
  const { data, isError, isLoading, refetch } = useTraffic({ from, to });

  if (isError) {
    return (
      <ErrorState message="No se pudo cargar la afluencia. Revisá la conexión y reintentá." onRetry={() => void refetch()} />
    );
  }
  if (isLoading || !data) return <LoadingState label="Cargando afluencia" />;
  const { totalIn, totalOut } = summarize(data);
  if (totalIn + totalOut === 0) return <EmptyState message="Sin ingresos ni egresos en este rango." />;
  return <TrafficChart points={data} timeZone={timeZone} />;
}
