"use client";

import { useState } from "react";

import { TextField } from "@/modules/registry/components/text-field";
import { useCreateLot } from "@/modules/registry/hooks";
import { hasErrors, validateLot } from "@/modules/registry/lib";
import type { FieldErrors, LotInput } from "@/modules/registry/types";

const EMPTY: LotInput = { code: "", street: "", number: "" };

export function LotForm() {
  const [input, setInput] = useState<LotInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const createLot = useCreateLot();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const local = validateLot(input);
    setErrors(local);
    if (hasErrors(local)) return;
    const outcome = await createLot.mutateAsync(input);
    if (outcome.kind === "done") {
      setNotice(`Lote ${input.code.trim()} creado.`);
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
        <TextField id="lot-code" label="Código catastral" value={input.code} error={errors.code} onChange={(code) => setInput({ ...input, code })} />
        <TextField id="lot-street" label="Calle" value={input.street} error={errors.street} onChange={(street) => setInput({ ...input, street })} />
        <TextField id="lot-number" label="Número" value={input.number} error={errors.number} onChange={(number) => setInput({ ...input, number })} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={createLot.isPending}
          className="min-h-12 rounded-md bg-text-primary px-6 text-sm font-medium text-bg-base disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        >
          {createLot.isPending ? "Creando lote..." : "Crear lote"}
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
