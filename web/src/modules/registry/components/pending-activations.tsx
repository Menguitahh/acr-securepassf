"use client";

import { useState } from "react";

import { EmptyState } from "@/common/components/empty-state";
import { ErrorState } from "@/common/components/error-state";
import { LoadingState } from "@/common/components/loading-state";
import { usePendingActivations, useResendAdminActivation } from "@/modules/registry/hooks";
import { describePending } from "@/modules/registry/lib";

const BUTTON =
  "min-h-12 rounded-md border border-border px-4 text-sm font-medium hover:bg-bg-elevated disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-text-primary";

// US-54: el admin reenvia la activacion desde Padron, donde dio de alta la
// cuenta. Las que crea el titular (familiares, trabajadores) tambien aparecen.
export function PendingActivations() {
  const { data, isError, isLoading, refetch } = usePendingActivations();
  const resend = useResendAdminActivation();
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);

  if (isError) {
    return (
      <ErrorState message="No se pudieron cargar las cuentas pendientes. Revisá la conexión y reintentá." onRetry={() => void refetch()} />
    );
  }
  if (isLoading || !data) return <LoadingState label="Cargando cuentas pendientes" />;
  if (!data.length) return <EmptyState message="No hay cuentas sin activar." />;

  const send = async (id: string, name: string) => {
    setNotice(null);
    const error = await resend.mutateAsync(id);
    setNotice({ id, text: error ?? `Le reenviamos el correo de activación a ${name}.` });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="text-text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Nombre</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Rol</th>
            <th className="px-4 py-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((user) => (
            <tr key={user.userId} className="border-t border-border align-top">
              <td className="px-4 py-3">{user.fullName}</td>
              <td className="px-4 py-3">{user.email ?? "Sin email"}</td>
              <td className="px-4 py-3">{describePending(user.roles, user.lotCodes)}</td>
              <td className="flex flex-col gap-2 px-4 py-3">
                <button
                  type="button"
                  className={BUTTON}
                  disabled={!user.email || resend.isPending}
                  onClick={() => void send(user.userId, user.fullName)}
                >
                  Reenviar activación
                </button>
                {notice?.id === user.userId && (
                  <p role="status" className="text-sm">
                    {notice.text}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
