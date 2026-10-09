interface Props {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-bg-surface p-6">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-12 rounded-md border border-border px-4 text-sm font-medium hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-text-primary"
      >
        Reintentar
      </button>
    </div>
  );
}
