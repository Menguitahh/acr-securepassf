"use client";

import { useState } from "react";

import { TextField } from "@/modules/registry/components/text-field";
import { useOnboardUser } from "@/modules/registry/hooks";
import { hasErrors, validateOnboard } from "@/modules/registry/lib";
import type { FieldErrors, OnboardInput, OnboardRole } from "@/modules/registry/types";

interface Props {
  // Prefijo de ids: puede haber un formulario de titular y uno de guardia.
  idPrefix: string;
  role: OnboardRole;
  lotId: string | null;
  submitLabel: string;
  doneMessage: string;
}

const EMPTY: OnboardInput = { fullName: "", dni: "", email: "" };

export function OnboardForm({ idPrefix, role, lotId, submitLabel, doneMessage }: Props) {
  const [input, setInput] = useState<OnboardInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const onboard = useOnboardUser();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const local = validateOnboard(input);
    setErrors(local);
    if (hasErrors(local)) return;
    const outcome = await onboard.mutateAsync({ input, role, lotId });
    if (outcome.kind === "done") {
      setNotice(`${input.fullName.trim()}: ${doneMessage}`);
      setInput(EMPTY);
    } else if (outcome.kind === "invalid") {
      setErrors(outcome.fields);
    } else {
      setNotice(outcome.message);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <TextField
          id={`${idPrefix}-name`}
          label="Nombre completo"
          value={input.fullName}
          error={errors.fullName}
          autoComplete="name"
          onChange={(fullName) => setInput({ ...input, fullName })}
        />
        <TextField
          id={`${idPrefix}-dni`}
          label="DNI"
          value={input.dni}
          error={errors.dni}
          inputMode="numeric"
          onChange={(dni) => setInput({ ...input, dni })}
        />
        <TextField
          id={`${idPrefix}-email`}
          label="Email"
          type="email"
          value={input.email}
          error={errors.email}
          autoComplete="email"
          onChange={(email) => setInput({ ...input, email })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={onboard.isPending}
          className="min-h-12 rounded-md bg-text-primary px-6 text-sm font-medium text-bg-base disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        >
          {onboard.isPending ? "Guardando..." : submitLabel}
        </button>
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
      </div>
    </form>
  );
}
