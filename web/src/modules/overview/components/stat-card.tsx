interface Props {
  label: string;
  value: number;
  emphasis?: boolean;
}

export function StatCard({ label, value, emphasis = false }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-surface p-5">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className={emphasis ? "text-5xl font-semibold tabular-nums" : "text-3xl font-semibold tabular-nums"}>
        {value.toLocaleString("es-AR")}
      </dd>
    </div>
  );
}
