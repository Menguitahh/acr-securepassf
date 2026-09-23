"use client";

import { useState } from "react";

import { RangeForm } from "@/common/components/range-form";
import { checkRange, defaultRange } from "@/common/date-range/lib";
import type { DateRange } from "@/common/date-range/types";
import { RESULT_OPTIONS } from "@/modules/access-log/data";
import { useAccessLogExport } from "@/modules/access-log/hooks";
import { exportNotice } from "@/modules/access-log/lib";
import type { ResultFilter } from "@/modules/access-log/types";
import { useSessionStore } from "@/modules/auth/session-store";

export function AccessLogView() {
  const session = useSessionStore((state) => state.session);
  // AdminGuard solo renderiza esto con sesion; el chequeo angosta el tipo.
  if (session.status !== "signedIn") return null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Bitácora</h1>
        <p className="text-sm text-text-muted">Registro de todos los accesos del barrio</p>
      </header>
      <ExportSection timeZone={session.user.neighborhoodTimezone} />
    </div>
  );
}

interface ExportSectionProps {
  timeZone: string;
}

function isResultFilter(value: string): value is ResultFilter {
  return RESULT_OPTIONS.some((option) => option.value === value);
}

function ExportSection({ timeZone }: ExportSectionProps) {
  const [range, setRange] = useState<DateRange>(() => defaultRange(timeZone, new Date()));
  const [result, setResult] = useState<ResultFilter>("ALL");
  const { mutate, isPending, data, coolingDown } = useAccessLogExport();
  const check = checkRange(range, timeZone);
  const notice = data ? exportNotice(data) : null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Exportar CSV</h2>
        <p className="text-sm text-text-muted">
          Accesos del rango en orden cronológico. Cada exportación queda registrada en auditoría.
        </p>
      </div>

      <RangeForm range={range} error={check.ok ? null : check.message} onChange={setRange} />

      <label className="flex flex-col gap-2 text-sm">
        Resultado
        <select
          value={result}
          onChange={(event) => {
            if (isResultFilter(event.target.value)) setResult(event.target.value);
          }}
          className="min-h-12 w-fit rounded-xl border border-border bg-bg-elevated px-4 text-base text-text-primary [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-text-primary"
        >
          {RESULT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        disabled={!check.ok || isPending || coolingDown}
        onClick={() => {
          if (check.ok) mutate({ range, instants: check.instants, result });
        }}
        className="min-h-12 w-fit rounded-md bg-text-primary px-5 font-medium text-bg-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary disabled:opacity-60"
      >
        {isPending ? "Exportando" : "Exportar CSV"}
      </button>

      {notice && (
        <p role={notice.tone} className="text-sm">
          {notice.text}
        </p>
      )}
    </section>
  );
}
