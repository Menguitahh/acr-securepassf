"use client";

import { useState } from "react";

import { EmptyState } from "@/common/components/empty-state";
import { ErrorState } from "@/common/components/error-state";
import { LoadingState } from "@/common/components/loading-state";
import { ImportForm } from "@/modules/registry/components/import-form";
import { PendingActivations } from "@/modules/registry/components/pending-activations";
import { PeopleSearch } from "@/modules/registry/components/people-search";
import { LotForm } from "@/modules/registry/components/lot-form";
import { LotsTable } from "@/modules/registry/components/lots-table";
import { OnboardForm } from "@/modules/registry/components/onboard-form";
import { LOTS_PAGE_SIZE } from "@/modules/registry/data";
import { useLots } from "@/modules/registry/hooks";

const PAGE_BUTTON =
  "min-h-12 rounded-md border border-border px-4 text-sm font-medium hover:bg-bg-elevated disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-text-primary";

export function RegistryView() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Padrón</h1>
        <p className="text-sm text-text-muted">Lotes del barrio, sus titulares y los guardias.</p>
      </header>
      <section aria-labelledby="lots-title" className="flex flex-col gap-3">
        <h2 id="lots-title" className="text-lg font-semibold">
          Lotes
        </h2>
        <LotsResult />
      </section>
      <section aria-labelledby="pending-title" className="flex flex-col gap-3">
        <h2 id="pending-title" className="text-lg font-semibold">
          Pendientes de activación
        </h2>
        <p className="text-sm text-text-muted">Cuentas que todavía no eligieron su contraseña. Si el correo venció, reenvialo.</p>
        <PendingActivations />
      </section>
      <section aria-labelledby="people-title" className="flex flex-col gap-3">
        <h2 id="people-title" className="text-lg font-semibold">
          Personas
        </h2>
        <p className="text-sm text-text-muted">
          Buscá a alguien del barrio para suspenderlo. Una persona suspendida no entra a ningún barrio de Securepass, y
          solo tu barrio puede levantar la suspensión.
        </p>
        <PeopleSearch />
      </section>
      <section aria-labelledby="new-lot-title" className="flex flex-col gap-3 rounded-lg border border-border bg-bg-surface p-6">
        <h2 id="new-lot-title" className="text-lg font-semibold">
          Nuevo lote
        </h2>
        <LotForm />
      </section>
      <section aria-labelledby="import-title" className="flex flex-col gap-3 rounded-lg border border-border bg-bg-surface p-6">
        <h2 id="import-title" className="text-lg font-semibold">
          Importar padrón
        </h2>
        <ImportForm />
      </section>
      <section aria-labelledby="new-guard-title" className="flex flex-col gap-3 rounded-lg border border-border bg-bg-surface p-6">
        <h2 id="new-guard-title" className="text-lg font-semibold">
          Alta de guardia
        </h2>
        <p className="text-sm text-text-muted">Le llega un mail para activar la cuenta y elegir su contraseña.</p>
        <OnboardForm
          idPrefix="guard"
          role="GUARD"
          lotId={null}
          submitLabel="Dar de alta guardia"
          doneMessage="guardia dado de alta. Le enviamos el mail de activación."
        />
      </section>
    </div>
  );
}

function LotsResult() {
  const [page, setPage] = useState(0);
  const { data, isError, isLoading, refetch } = useLots(page);

  if (isError) {
    return (
      <ErrorState message="No se pudieron cargar los lotes. Revisá la conexión y reintentá." onRetry={() => void refetch()} />
    );
  }
  if (isLoading || !data) return <LoadingState label="Cargando lotes" />;
  if (!data.length && page === 0) return <EmptyState message="Todavía no hay lotes. Creá el primero abajo." />;
  return (
    <div className="flex flex-col gap-3">
      <LotsTable rows={data} />
      {/* El endpoint no devuelve total: hay siguiente si la pagina vino llena. */}
      <nav aria-label="Paginas de lotes" className="flex gap-2">
        <button type="button" className={PAGE_BUTTON} disabled={page === 0} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <button type="button" className={PAGE_BUTTON} disabled={data.length < LOTS_PAGE_SIZE} onClick={() => setPage(page + 1)}>
          Siguiente
        </button>
      </nav>
    </div>
  );
}
