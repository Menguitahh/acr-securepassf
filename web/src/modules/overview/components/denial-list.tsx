import { EmptyState } from "@/common/components/empty-state";
import type { DenialRow } from "@/common/denials/types";

interface Props {
  rows: DenialRow[];
}

export function DenialList({ rows }: Props) {
  if (!rows.length) return <EmptyState message="Sin accesos denegados hoy." />;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-bg-surface">
      {rows.map((row) => (
        <li key={row.reason} className="flex min-h-12 items-center justify-between gap-4 px-5">
          <span>{row.label}</span>
          <span className="font-semibold tabular-nums">{row.count.toLocaleString("es-AR")}</span>
        </li>
      ))}
    </ul>
  );
}
