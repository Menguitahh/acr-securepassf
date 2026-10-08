import { isDenialReason } from "@/common/denials/lib";
import type { DenialReason, DenialRow } from "@/common/denials/types";

interface Props {
  rows: DenialRow[];
  selected: DenialReason | null;
  onSelect: (reason: DenialReason) => void;
}

// Un motivo que el front todavia no conoce se cuenta pero no se abre: el
// filtro reason= solo acepta los valores del enum.
export function ReasonList({ rows, selected, onSelect }: Props) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-bg-surface">
      {rows.map((row) => {
        const reason = row.reason;
        const content = (
          <>
            <span>{row.label}</span>
            <span className="font-semibold tabular-nums">{row.count.toLocaleString("es-AR")}</span>
          </>
        );
        if (!isDenialReason(reason)) {
          return (
            <li key={reason} className="flex min-h-12 items-center justify-between gap-4 px-5 text-text-muted">
              {content}
            </li>
          );
        }
        return (
          <li key={reason}>
            <button
              type="button"
              aria-pressed={selected === reason}
              onClick={() => onSelect(reason)}
              className="flex min-h-12 w-full items-center justify-between gap-4 px-5 text-left hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-text-primary aria-pressed:bg-bg-elevated aria-pressed:font-medium"
            >
              {content}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
