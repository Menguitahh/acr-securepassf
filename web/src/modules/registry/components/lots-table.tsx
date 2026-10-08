"use client";

import { Fragment, useState } from "react";

import { OnboardForm } from "@/modules/registry/components/onboard-form";
import { LOT_STATUS_LABELS } from "@/modules/registry/data";
import { useUpdateLotStatus } from "@/modules/registry/hooks";
import { statusAction } from "@/modules/registry/lib";
import type { LotRow } from "@/modules/registry/types";

interface Props {
  rows: LotRow[];
}

const HEADERS = ["Código", "Dirección", "Estado", "Acciones"];

const BUTTON =
  "min-h-12 rounded-md border border-border px-4 text-sm font-medium hover:bg-bg-elevated disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-text-primary";

// Una sola fila abierta a la vez: confirmar el cambio de estado o cargar un
// titular. Abrir otra cierra la anterior.
type Open = { kind: "confirm"; id: string } | { kind: "onboard"; id: string } | null;

export function LotsTable({ rows }: Props) {
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const updateStatus = useUpdateLotStatus();

  const confirm = async (row: LotRow) => {
    const action = statusAction(row.status);
    if (action.kind === "none") return;
    setError(null);
    const outcome = await updateStatus.mutateAsync({ id: row.id, status: action.next });
    if (outcome.kind === "done") setOpen(null);
    else setError({ id: row.id, message: outcome.kind === "error" ? outcome.message : "Revisá los datos y reintentá." });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-text-muted">
          <tr className="h-12">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-4 font-normal">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const action = statusAction(row.status);
            const confirming = open?.kind === "confirm" && open.id === row.id;
            const onboarding = open?.kind === "onboard" && open.id === row.id;
            return (
              <Fragment key={row.id}>
                <tr className="h-12 align-middle">
                  <td className="px-4 py-3 font-medium">{row.code}</td>
                  <td className="px-4 py-3">{row.address || <span className="text-text-muted">Sin dirección</span>}</td>
                  <td className="px-4 py-3">{LOT_STATUS_LABELS[row.status]}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={BUTTON}
                        aria-expanded={onboarding}
                        onClick={() => setOpen(onboarding ? null : { kind: "onboard", id: row.id })}
                      >
                        Alta de titular
                      </button>
                      {action.kind !== "none" && (
                        <button
                          type="button"
                          className={BUTTON}
                          aria-expanded={confirming}
                          onClick={() => setOpen(confirming ? null : { kind: "confirm", id: row.id })}
                        >
                          {action.label}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {confirming && action.kind !== "none" && (
                  <tr>
                    <td colSpan={HEADERS.length} className="bg-bg-elevated px-4 py-4">
                      <div role="group" aria-label={`Confirmar ${action.label.toLowerCase()} ${row.code}`} className="flex flex-col gap-3">
                        <p>
                          {action.kind === "suspend"
                            ? `Suspender el lote ${row.code} rechaza toda invitación nueva y toda validación de sus pases. Los residentes del lote pueden seguir entrando.`
                            : `Reactivar el lote ${row.code} vuelve a habilitar sus invitaciones y pases.`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={updateStatus.isPending}
                            onClick={() => void confirm(row)}
                            className="min-h-12 rounded-md bg-text-primary px-6 text-sm font-medium text-bg-base disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
                          >
                            {action.kind === "suspend" ? `Suspender ${row.code}` : `Reactivar ${row.code}`}
                          </button>
                          <button type="button" className={BUTTON} onClick={() => setOpen(null)}>
                            Cancelar
                          </button>
                        </div>
                        {error?.id === row.id && (
                          <p role="alert" className="text-sm">
                            {error.message}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {onboarding && (
                  <tr>
                    <td colSpan={HEADERS.length} className="bg-bg-elevated px-4 py-4">
                      <div className="flex flex-col gap-3">
                        <p className="text-text-muted">
                          Titular del lote {row.code}. Le llega un mail para activar la cuenta y elegir su contraseña.
                        </p>
                        <OnboardForm
                          idPrefix={`owner-${row.id}`}
                          role="RESIDENT_OWNER"
                          lotId={row.id}
                          submitLabel="Dar de alta titular"
                          doneMessage="titular dado de alta. Le enviamos el mail de activación."
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
