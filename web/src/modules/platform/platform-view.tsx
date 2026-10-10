"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { EmptyState } from "@/common/components/empty-state";
import { ErrorState } from "@/common/components/error-state";
import { LoadingState } from "@/common/components/loading-state";
import { Splash } from "@/modules/auth/components/splash";
import { logout, setViewing } from "@/modules/auth/session";
import { useSessionStore } from "@/modules/auth/session-store";
import { CreateNeighborhoodForm } from "@/modules/platform/components/create-neighborhood-form";
import { ADMIN_STATUS_LABELS } from "@/modules/platform/data";
import { useNeighborhoods } from "@/modules/platform/hooks";
import type { NeighborhoodOverview } from "@/modules/platform/types";

const BUTTON =
  "min-h-12 rounded-md border border-border px-4 text-sm font-medium hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-text-primary";

// #229: panel del duenio de la plataforma. Un admin de barrio que llega aca
// vuelve a su dashboard; sin sesion, al login.
export function PlatformView() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const isPlatform = session.status === "signedIn" && session.user.kind === "platform";

  useEffect(() => {
    if (session.status === "signedOut") router.replace("/login");
    else if (session.status === "signedIn" && session.user.kind !== "platform") router.replace("/");
  }, [session, router]);

  if (!isPlatform) return <Splash />;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Barrios</h1>
          <p className="text-sm text-text-muted">
            Todos los barrios de Securepass. Entrá a uno para ver su dashboard en modo lectura.
          </p>
        </div>
        <button type="button" className={BUTTON} onClick={logout}>
          Cerrar sesión
        </button>
      </header>
      <section aria-labelledby="nb-list-title" className="flex flex-col gap-3">
        <h2 id="nb-list-title" className="text-lg font-semibold">
          Barrios
        </h2>
        <NeighborhoodsResult
          onView={(n) => {
            setViewing({ id: n.id, name: n.name, timeZone: n.timezone });
            router.push("/");
          }}
        />
      </section>
      <section aria-labelledby="nb-new-title" className="flex flex-col gap-3 rounded-lg border border-border bg-bg-surface p-6">
        <h2 id="nb-new-title" className="text-lg font-semibold">
          Nuevo barrio
        </h2>
        <p className="text-sm text-text-muted">Se crea con su garita principal y la clave para firmar los QR.</p>
        <CreateNeighborhoodForm />
      </section>
    </main>
  );
}

interface ResultProps {
  onView: (neighborhood: NeighborhoodOverview) => void;
}

function NeighborhoodsResult({ onView }: ResultProps) {
  const { data, isError, isLoading, refetch } = useNeighborhoods();

  if (isError) {
    return <ErrorState message="No se pudieron cargar los barrios. Revisá la conexión y reintentá." onRetry={() => void refetch()} />;
  }
  if (isLoading || !data) return <LoadingState label="Cargando barrios" />;
  if (!data.length) return <EmptyState message="Todavía no hay barrios. Creá el primero abajo." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="text-text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Barrio</th>
            <th className="px-4 py-2 font-medium">Lotes</th>
            <th className="px-4 py-2 font-medium">Admins</th>
            <th className="px-4 py-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((n) => (
            <tr key={n.id} className="border-t border-border align-top">
              <td className="px-4 py-3">
                <p className="font-medium">{n.name}</p>
                <p className="text-text-muted">{n.slug}</p>
              </td>
              <td className="px-4 py-3">{n.lotCount}</td>
              <td className="px-4 py-3">
                {n.admins.length ? (
                  <ul className="flex flex-col gap-1">
                    {n.admins.map((a) => (
                      <li key={`${n.id}-${a.email ?? a.fullName}`}>
                        {a.fullName}
                        <span className="text-text-muted"> · {a.email ?? "Sin email"} · {ADMIN_STATUS_LABELS[a.status] ?? a.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-text-muted">Sin admin</span>
                )}
              </td>
              <td className="px-4 py-3">
                <button type="button" className={BUTTON} onClick={() => onView(n)}>
                  Ver barrio
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
