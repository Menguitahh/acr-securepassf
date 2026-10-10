"use client";

import { useState } from "react";

import { EmptyState } from "@/common/components/empty-state";
import { ErrorState } from "@/common/components/error-state";
import { LoadingState } from "@/common/components/loading-state";
import { PERSON_STATUS_LABELS, SUSPEND_REASON_MAX } from "@/modules/registry/data";
import { useLiftSuspension, usePeopleSearch, useSuspendUser } from "@/modules/registry/hooks";
import { describePending, describeSuspension, validateSuspendReason } from "@/modules/registry/lib";
import type { Person } from "@/modules/registry/types";

const BUTTON =
  "min-h-12 rounded-md border border-border px-4 text-sm font-medium hover:bg-bg-elevated disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-text-primary";
const INPUT =
  "min-h-12 rounded-xl border border-border bg-bg-elevated px-4 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-text-primary aria-[invalid=true]:border-text-primary";

// #121: buscar por nombre o DNI y suspender, o levantar una suspension que
// puso este barrio. Busca al enviar: sin pedidos por cada tecla.
export function PeopleSearch() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const people = usePeopleSearch(term);

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setTerm(query.trim());
        }}
      >
        <label htmlFor="people-query" className="flex flex-col gap-2 text-sm">
          Nombre o DNI
          <input
            id="people-query"
            type="search"
            value={query}
            minLength={2}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
            className={INPUT}
          />
        </label>
        <button type="submit" className={BUTTON} disabled={query.trim().length < 2}>
          Buscar
        </button>
      </form>
      <Results term={term} people={people} />
    </div>
  );
}

interface ResultsProps {
  term: string;
  people: ReturnType<typeof usePeopleSearch>;
}

function Results({ term, people }: ResultsProps) {
  if (term.length < 2) return null;
  if (people.isError) {
    return (
      <ErrorState message="No se pudo buscar. Revisá la conexión y reintentá." onRetry={() => void people.refetch()} />
    );
  }
  if (people.isLoading || !people.data) return <LoadingState label="Buscando personas" />;
  if (!people.data.length) return <EmptyState message="No hay nadie del barrio con ese nombre o DNI." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="text-text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Nombre</th>
            <th className="px-4 py-2 font-medium">DNI</th>
            <th className="px-4 py-2 font-medium">Rol</th>
            <th className="px-4 py-2 font-medium">Estado</th>
            <th className="px-4 py-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {people.data.map((person) => (
            <PersonRow key={person.userId} person={person} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PersonRowProps {
  person: Person;
}

function PersonRow({ person }: PersonRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const suspend = useSuspendUser();
  const lift = useLiftSuspension();
  const reasonId = `suspend-reason-${person.userId}`;

  const confirmSuspend = async () => {
    const local = validateSuspendReason(reason);
    setReasonError(local);
    if (local) return;
    const error = await suspend
      .mutateAsync({ userId: person.userId, reason })
      .catch(() => "No se pudo suspender. Revisá la conexión y reintentá.");
    if (error) {
      setReasonError(error);
      return;
    }
    setConfirming(false);
    setReason("");
    setNotice(`Persona suspendida: ${person.fullName}. Ya no puede entrar a ningún barrio.`);
  };

  const confirmLift = async () => {
    const error = await lift
      .mutateAsync(person.userId)
      .catch(() => "No se pudo levantar la suspensión. Revisá la conexión y reintentá.");
    setNotice(error ?? `Suspensión levantada. ${person.fullName} puede volver a entrar.`);
  };

  const suspension = person.suspension;
  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3">{person.fullName}</td>
      <td className="px-4 py-3">{person.documentNumber ?? "Sin DNI"}</td>
      <td className="px-4 py-3">{describePending(person.roles, person.lotCodes)}</td>
      <td className="px-4 py-3">
        {PERSON_STATUS_LABELS[person.status] ?? person.status}
        {suspension && <p className="mt-1 text-text-muted">{describeSuspension(suspension)}</p>}
      </td>
      <td className="flex flex-col gap-2 px-4 py-3">
        {person.status !== "SUSPENDED" && !confirming && (
          <button type="button" className={BUTTON} onClick={() => setConfirming(true)}>
            Suspender
          </button>
        )}
        {confirming && (
          <div className="flex flex-col gap-2">
            <label htmlFor={reasonId} className="flex flex-col gap-2">
              Motivo (lo ven los admins de otros barrios)
              <textarea
                id={reasonId}
                value={reason}
                maxLength={SUSPEND_REASON_MAX}
                rows={3}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={reasonError !== null}
                aria-describedby={reasonError ? `${reasonId}-error` : undefined}
                className={`${INPUT} py-3`}
              />
            </label>
            {reasonError && (
              <span id={`${reasonId}-error`} className="text-sm">
                {reasonError}
              </span>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BUTTON} disabled={suspend.isPending} onClick={() => void confirmSuspend()}>
                {suspend.isPending ? "Suspendiendo..." : "Confirmar suspensión"}
              </button>
              <button
                type="button"
                className={BUTTON}
                onClick={() => {
                  setConfirming(false);
                  setReasonError(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {suspension?.ownNeighborhood && (
          <button type="button" className={BUTTON} disabled={lift.isPending} onClick={() => void confirmLift()}>
            {lift.isPending ? "Levantando..." : "Levantar suspensión"}
          </button>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
      </td>
    </tr>
  );
}
