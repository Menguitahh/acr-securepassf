interface Props {
  id: string;
  label: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  type?: "text" | "email";
  inputMode?: "text" | "numeric" | "email";
  autoComplete?: string;
}

const INPUT =
  "min-h-12 rounded-xl border border-border bg-bg-elevated px-4 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-text-primary aria-[invalid=true]:border-text-primary";

export function TextField({ id, label, value, error, onChange, type = "text", inputMode, autoComplete }: Props) {
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm">
      {label}
      <input
        id={id}
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={error ? errorId : undefined}
        className={INPUT}
      />
      {error && (
        <span id={errorId} className="text-sm">
          {error}
        </span>
      )}
    </label>
  );
}
