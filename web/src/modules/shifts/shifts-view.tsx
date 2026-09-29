"use client";

import { useState } from "react";

import { EmptyState } from "@/common/components/empty-state";
import { ErrorState } from "@/common/components/error-state";
import { LoadingState } from "@/common/components/loading-state";
import { Pagination } from "@/common/components/pagination";
import { useSessionStore } from "@/modules/auth/session-store";
import { ShiftsTable } from "@/modules/shifts/components/shifts-table";
import { useShifts } from "@/modules/shifts/hooks";

export function ShiftsView() {
  const session = useSessionStore((state) => state.session);
  // AdminGuard solo renderiza esto con sesion; el chequeo angosta el tipo.
  if (session.status !== "signedIn") return null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Turnos</h1>
        <p className="text-sm text-text-muted">
          Turnos de guardia, más recientes primero · la primera página se actualiza cada minuto
        </p>
      </header>
      <ShiftsResult timeZone={session.user.neighborhoodTimezone} />
    </div>
  );
}

interface ResultProps {
  timeZone: string;
}

function ShiftsResult({ timeZone }: ResultProps) {
  const [page, setPage] = useState(0);
  const { data, isError, isLoading, refetch } = useShifts(page);

  if (isError) {
    return (
      <ErrorState
        message="No se pudieron cargar los turnos. Revisá la conexión y reintentá."
        onRetry={() => void refetch()}
      />
    );
  }
  if (isLoading || !data) return <LoadingState label="Cargando turnos" />;
  if (!data.total) return <EmptyState message="Todavía no hay turnos registrados." />;
  return (
    <div className="flex flex-col gap-3">
      <ShiftsTable rows={data.rows} timeZone={timeZone} />
      <Pagination page={page} total={data.total} size={data.size} onChange={setPage} />
    </div>
  );
}
