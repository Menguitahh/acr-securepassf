interface Props {
  message: string;
}

export function EmptyState({ message }: Props) {
  return <p className="rounded-lg border border-border bg-bg-surface p-6 text-text-muted">{message}</p>;
}
