"use client";

import { useState } from "react";

import { IMPORT_COLUMNS, IMPORT_TEMPLATE } from "@/modules/registry/data";
import { useAllLotCodes, useImportRegistry } from "@/modules/registry/hooks";
import { toImportPreview } from "@/modules/registry/lib";
import type { ImportPreview, ImportRow } from "@/modules/registry/types";

const PRIMARY =
  "min-h-12 rounded-md bg-text-primary px-6 text-sm font-medium text-bg-base disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary";
const SECONDARY =
  "min-h-12 rounded-md border border-border px-4 text-sm font-medium hover:bg-bg-elevated disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-text-primary";

// US-09 (#214): preview antes de confirmar; los errores son por fila y no
// frenan el resto del archivo.
export function ImportForm() {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const codes = useAllLotCodes(text !== null);
  const importRegistry = useImportRegistry();

  const existing = codes.data ?? new Map<string, string>();
  const preview: ImportPreview | null = text === null || !codes.data ? null : toImportPreview(text, new Set(existing.keys()));
  const ready: ImportRow[] =
    preview?.kind === "ok"
      ? // Un lote que ya existe y no trae titular no tiene nada que importar.
        preview.rows.flatMap((r) => (r.status === "ready" && (!r.lotExists || r.row.owner) ? [r.row] : []))
      : [];

  const onFile = async (file: File | undefined) => {
    importRegistry.reset();
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
  };

  const results = importRegistry.data;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Subí un CSV con las columnas <code>{IMPORT_COLUMNS.join(",")}</code>. Solo <code>codigo</code> es obligatoria;
        el titular va completo o vacío. Antes de importar vas a ver qué filas entran y cuáles hay que corregir.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label htmlFor="registry-csv" className="text-sm font-medium">
          Archivo CSV
        </label>
        <input
          id="registry-csv"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void onFile(event.target.files?.[0])}
          disabled={importRegistry.isPending}
          className="min-h-12 text-sm file:mr-4 file:min-h-12 file:rounded-md file:border file:border-border file:bg-bg-elevated file:px-4 file:text-text-primary"
        />
        <a
          className="text-sm underline"
          download="padron-ejemplo.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(IMPORT_TEMPLATE)}`}
        >
          Bajar CSV de ejemplo
        </a>
      </div>

      {codes.isError && (
        <p role="alert" className="text-sm">
          No se pudieron revisar los lotes existentes. Revisá la conexión y volvé a elegir el archivo.
        </p>
      )}
      {text !== null && codes.isLoading && <p className="text-sm text-text-muted">Revisando {fileName}...</p>}
      {preview?.kind === "error" && (
        <p role="alert" className="text-sm">
          {preview.message}
        </p>
      )}

      {preview?.kind === "ok" && !results && (
        <>
          <p className="text-sm">
            {ready.length} de {preview.rows.length} filas listas para importar
            {preview.rows.some((r) => r.status === "invalid")
              ? ". Las que tienen error no se importan: corregilas en el archivo."
              : "."}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="text-text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Fila</th>
                  <th className="px-4 py-2 font-medium">Código</th>
                  <th className="px-4 py-2 font-medium">Titular</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-t border-border">
                    <td className="px-4 py-2">{r.line}</td>
                    <td className="px-4 py-2">{r.status === "ready" ? r.row.code : r.code || "—"}</td>
                    <td className="px-4 py-2">{r.status === "ready" ? (r.row.owner?.fullName ?? "—") : "—"}</td>
                    <td className="px-4 py-2">
                      {r.status === "invalid"
                        ? `Error: ${r.message}`
                        : r.lotExists
                          ? r.row.owner
                            ? "El lote ya existe: se le suma el titular"
                            : "El lote ya existe: no hay nada que importar"
                          : "Listo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              className={PRIMARY}
              disabled={importRegistry.isPending || ready.length === 0}
              onClick={() => importRegistry.mutate({ rows: ready, existing })}
            >
              {importRegistry.isPending ? "Importando..." : `Importar ${ready.length} filas`}
            </button>
            <button type="button" className={SECONDARY} disabled={importRegistry.isPending} onClick={() => setText(null)}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {results && (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Importación terminada: {results.filter((r) => r.ok).length} filas importadas,{" "}
            {results.filter((r) => !r.ok).length} con error.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {results.map((r) => (
              <li key={r.line}>
                Fila {r.line} ({r.code}): {r.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
