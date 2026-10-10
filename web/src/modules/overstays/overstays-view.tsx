"use client";

import { EmptyState } from "@/common/components/empty-state";
import { ErrorState } from "@/common/components/error-state";
import { LoadingState } from "@/common/components/loading-state";
import { useNeighborhoodTimeZone } from "@/modules/auth/hooks";
import { OverstaysTable } from "@/modules/overstays/components/overstays-table";
import { useOverstays } from "@/modules/overstays/hooks";

export function OverstaysView() {
  const timeZone = useNeighborhoodTimeZone();
  // AdminGuard solo renderiza esto dentro de un barrio; el chequeo angosta el tipo.
  if (!timeZone) return null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Permanencia</h1>
        <p className="text-sm text-text-muted">
          Personas adentro que pasaron el tiempo de alerta del barrio · se actualiza cada minuto
        </p>
      </header>
      <OverstaysResult timeZone={timeZone} />
    </div>
  );
}

interface ResultProps {
  timeZone: string;
}

function OverstaysResult({ timeZone }: ResultProps) {
  const { data, isError, isLoading, refetch } = useOverstays();

  if (isError) {
    return (
      <ErrorState
        message="No se pudieron cargar las permanencias. Revisá la conexión y reintentá; también se reintenta sola cada minuto."
        onRetry={() => void refetch()}
      />
    );
  }
  if (isLoading || !data) return <LoadingState label="Cargando permanencias" />;
  if (!data.length) return <EmptyState message="Sin permanencias excedidas ahora mismo." />;
  return <OverstaysTable rows={data} timeZone={timeZone} />;
}
