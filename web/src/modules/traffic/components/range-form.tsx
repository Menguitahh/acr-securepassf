import type { DateRange } from "@/modules/traffic/types";

interface Props {
  range: DateRange;
  error: string | null;
  onChange: (range: DateRange) => void;
}

const INPUT =
  "min-h-12 rounded-xl border border-border bg-bg-elevated px-4 text-base text-text-primary [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-text-primary";

export function RangeForm({ range, error, onChange }: Props) {
  const describedBy = error ? "range-error" : undefined;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Rango de fechas</legend>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2 text-sm">
          Desde
          <input
            type="date"
            value={range.from}
            onChange={(event) => onChange({ ...range, from: event.target.value })}
            aria-invalid={error !== null}
            aria-describedby={describedBy}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Hasta
          <input
            type="date"
            value={range.to}
            onChange={(event) => onChange({ ...range, to: event.target.value })}
            aria-invalid={error !== null}
            aria-describedby={describedBy}
            className={INPUT}
          />
        </label>
      </div>
      {error && (
        <p id="range-error" role="alert" className="text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
