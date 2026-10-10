"use client";

import { useState } from "react";

import { TextField } from "@/modules/registry/components/text-field";
import { DEFAULT_TIMEZONE, TIMEZONES } from "@/modules/platform/data";
import { useCreateNeighborhood } from "@/modules/platform/hooks";
import { slugify, validateNewNeighborhood } from "@/modules/platform/lib";
import type { NewNeighborhoodErrors, NewNeighborhoodInput } from "@/modules/platform/types";

const EMPTY: NewNeighborhoodInput = {
  name: "",
  slug: "",
  timezone: DEFAULT_TIMEZONE,
  adminFullName: "",
  adminDni: "",
  adminEmail: "",
};

const SELECT =
  "min-h-12 rounded-xl border border-border bg-bg-elevated px-4 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-text-primary";

// Crea el barrio con su garita y su primer admin, que recibe el mail para
// activar la cuenta. El identificador sale del nombre hasta que se edita.
export function CreateNeighborhoodForm() {
  const [input, setInput] = useState<NewNeighborhoodInput>(EMPTY);
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<NewNeighborhoodErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const create = useCreateNeighborhood();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const local = validateNewNeighborhood(input);
    setErrors(local);
    if (Object.keys(local).length) return;
    const outcome = await create
      .mutateAsync(input)
      .catch(() => ({ kind: "error" as const, message: "No se pudo crear el barrio. Revisá la conexión y reintentá." }));
    if (outcome.kind === "done") {
      setNotice(`Barrio creado: ${input.name.trim()}. Le enviamos a ${input.adminEmail.trim()} el mail para activar su cuenta.`);
      setInput(EMPTY);
      setSlugEdited(false);
    } else {
      setNotice(outcome.message);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <TextField
          id="nb-name"
          label="Nombre del barrio"
          value={input.name}
          error={errors.name}
          onChange={(name) => setInput({ ...input, name, slug: slugEdited ? input.slug : slugify(name) })}
        />
        <TextField
          id="nb-slug"
          label="Identificador"
          value={input.slug}
          error={errors.slug}
          onChange={(slug) => {
            setSlugEdited(true);
            setInput({ ...input, slug });
          }}
        />
        <label htmlFor="nb-tz" className="flex flex-col gap-2 text-sm">
          Horario
          <select
            id="nb-tz"
            value={input.timezone}
            onChange={(event) => setInput({ ...input, timezone: event.target.value })}
            className={SELECT}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-text-muted">Primer admin del barrio</p>
      <div className="flex flex-wrap items-start gap-4">
        <TextField
          id="nb-admin-name"
          label="Nombre completo"
          value={input.adminFullName}
          error={errors.adminFullName}
          autoComplete="off"
          onChange={(adminFullName) => setInput({ ...input, adminFullName })}
        />
        <TextField
          id="nb-admin-dni"
          label="DNI"
          value={input.adminDni}
          error={errors.adminDni}
          inputMode="numeric"
          onChange={(adminDni) => setInput({ ...input, adminDni })}
        />
        <TextField
          id="nb-admin-email"
          label="Email"
          type="email"
          value={input.adminEmail}
          error={errors.adminEmail}
          autoComplete="off"
          onChange={(adminEmail) => setInput({ ...input, adminEmail })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={create.isPending}
          className="min-h-12 rounded-md bg-text-primary px-6 text-sm font-medium text-bg-base disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
        >
          {create.isPending ? "Creando..." : "Crear barrio"}
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
