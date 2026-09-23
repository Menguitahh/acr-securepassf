interface Props {
  label: string;
}

export function LoadingState({ label }: Props) {
  return (
    <p role="status" className="text-text-muted">
      {label}
    </p>
  );
}
