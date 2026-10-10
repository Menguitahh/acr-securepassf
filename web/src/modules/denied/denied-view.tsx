"use client";

import { useState } from "react";

import { todayIn } from "@/common/date-range/lib";
import { EmptyState } from "@/common/components/empty-state";
import { ErrorState } from "@/common/components/error-state";
import { LoadingState } from "@/common/components/loading-state";
import { Pagination } from "@/common/components/pagination";
import { DENIAL_LABELS } from "@/common/denials/data";
import type { DenialReason } from "@/common/denials/types";
import { useNeighborhoodTimeZone } from "@/modules/auth/hooks";
import { DeniedTable } from "@/modules/denied/components/denied-table";
import { ReasonList } from "@/modules/denied/components/reason-list";
import { useDenialCounts, useDeniedLogs } from "@/modules/denied/hooks";
import { checkDay } from "@/modules/denied/lib";

const INPUT =
  "min-h-12 w-fit rounded-xl border border-border bg-bg-elevated px-4 text-base text-text-primary [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-text-primary";

export function DeniedView() {
  const timeZone = useNeighborhoodTimeZone();
  // AdminGuard solo renderiza esto dentro de un barrio; el chequeo angosta el tipo.
  if (!timeZone) return null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Denegados</h1>
        <p className="text-sm text-text-muted">Accesos denegados del día por motivo. Elegí un motivo para ver cada registro.</p>
      </header>
      <DeniedDay timeZone={timeZone} />
    </div>
  );
}

interface DayProps {
  timeZone: string;
}

function DeniedDay({ timeZone }: DayProps) {
  const [today] = useState(() => todayIn(timeZone, new Date()));
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState<DenialReason | null>(null);
  const check = checkDay(date, timeZone, new Date());

  return (
    <>
      <label className="flex flex-col gap-2 text-sm">
        Día
        <input
          type="date"
          value={date}
          max={today}
          onChange={(event) => {
            setDate(event.target.value);
            setReason(null);
          }}
          aria-invalid={!check.ok}
          aria-describedby={check.ok ? undefined : "day-error"}
          className={INPUT}
        />
        {!check.ok && (
          <span id="day-error" role="alert">
            {check.message}
          </span>
        )}
      </label>

      {check.ok && <ReasonsResult date={date} reason={reason} onSelect={setReason} />}

      {/* key por dia y motivo: al cambiar cualquiera de los dos, el
          drill-down se monta de nuevo y arranca en la pagina 1, sin mostrar
          filas del motivo anterior mientras carga el nuevo. */}
      {check.ok && reason && (
        <DeniedLogs
          key={`${check.from}|${reason}`}
          from={check.from}
          to={check.to}
          reason={reason}
          timeZone={timeZone}
        />
      )}
    </>
  );
}

interface ReasonsProps {
  date: string;
  reason: DenialReason | null;
  onSelect: (reason: DenialReason) => void;
}

function ReasonsResult({ date, reason, onSelect }: ReasonsProps) {
  const { data, isError, isLoading, refetch } = useDenialCounts(date);
  if (isError) {
    return (
      <ErrorState
        message="No se pudieron cargar los denegados del día. Revisá la conexión y reintentá."
        onRetry={() => void refetch()}
      />
    );
  }
  if (isLoading || !data) return <LoadingState label="Cargando denegados" />;
  if (!data.length) return <EmptyState message="Sin accesos denegados ese día." />;
  return <ReasonList rows={data} selected={reason} onSelect={onSelect} />;
}

interface LogsProps {
  from: string;
  to: string;
  reason: DenialReason;
  timeZone: string;
}

function DeniedLogs({ from, to, reason, timeZone }: LogsProps) {
  const [page, setPage] = useState(0);
  const { data, isError, isLoading, refetch } = useDeniedLogs(from, to, reason, page);
  const label = DENIAL_LABELS[reason];

  if (isError) {
    return (
      <ErrorState
        message={`No se pudieron cargar los registros de "${label}". Revisá la conexión y reintentá.`}
        onRetry={() => void refetch()}
      />
    );
  }
  if (isLoading || !data) return <LoadingState label={`Cargando registros de ${label}`} />;
  if (!data.total) return <EmptyState message={`Sin registros de "${label}" ese día.`} />;
  return (
    <section className="flex flex-col gap-3" aria-label={`Registros de ${label}`}>
      <h2 className="text-lg font-semibold">
        {label} · <span className="tabular-nums">{data.total.toLocaleString("es-AR")}</span>
      </h2>
      <DeniedTable rows={data.rows} timeZone={timeZone} />
      <Pagination page={page} total={data.total} size={data.size} onChange={setPage} />
    </section>
  );
}
