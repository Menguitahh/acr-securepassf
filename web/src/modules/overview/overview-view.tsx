"use client";

import { ErrorState } from "@/common/components/error-state";
import { LoadingState } from "@/common/components/loading-state";
import { formatLocalDate } from "@/common/lib/datetime";
import { DenialList } from "@/modules/overview/components/denial-list";
import { StatCard } from "@/modules/overview/components/stat-card";
import { useOverview } from "@/modules/overview/hooks";

export function OverviewView() {
  const { data, isError, isLoading, refetch } = useOverview();

  if (isError) {
    return (
      <ErrorState
        message="No se pudo cargar la ocupación. Revisá la conexión y reintentá; también se reintenta sola cada 30 segundos."
        onRetry={() => void refetch()}
      />
    );
  }
  if (isLoading || !data) return <LoadingState label="Cargando ocupación" />;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Ocupación</h1>
        <p className="text-sm text-text-muted">Hoy, {formatLocalDate(data.date)} · se actualiza cada 30 segundos</p>
      </header>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Adentro ahora" value={data.currentOccupancy} emphasis />
        <StatCard label="Ingresos hoy" value={data.allowedIn} />
        <StatCard label="Egresos hoy" value={data.allowedOut} />
        <StatCard label="Denegados hoy" value={data.denied} />
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Denegados por motivo</h2>
        <DenialList rows={data.denials} />
      </section>
    </div>
  );
}
