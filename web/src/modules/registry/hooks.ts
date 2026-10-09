"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/common/api/client";
import { toLotRows, toSubmitOutcome } from "@/modules/registry/lib";
import { LOTS_PAGE_SIZE } from "@/modules/registry/data";
import type {
  ImportResultRow,
  ImportRow,
  LotInput,
  LotStatus,
  OnboardInput,
  OnboardRole,
  SubmitOutcome,
} from "@/modules/registry/types";

const LOTS_KEY = ["admin-lots"] as const;

export function useLots(page: number) {
  return useQuery({
    queryKey: [...LOTS_KEY, page],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/lots", { params: { query: { page } } });
      if (!response.ok || !data) throw new Error(`Lots HTTP ${response.status}`);
      return toLotRows(data);
    },
    placeholderData: keepPreviousData,
  });
}

function blank(value: string): string | undefined {
  return value.trim() || undefined;
}

export function useCreateLot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LotInput): Promise<SubmitOutcome> => {
      const street = blank(input.street);
      const number = blank(input.number);
      const { error, response } = await api.POST("/api/v1/admin/lots", {
        body: { code: input.code.trim(), ...(street ? { street } : {}), ...(number ? { number } : {}) },
      });
      return toSubmitOutcome(response.status, error, "Ya hay un lote con ese código en el barrio. Usá otro código.");
    },
    onSuccess: (outcome) => {
      if (outcome.kind === "done") void queryClient.invalidateQueries({ queryKey: LOTS_KEY });
    },
  });
}

export function useUpdateLotStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LotStatus }): Promise<SubmitOutcome> => {
      const { error, response } = await api.PATCH("/api/v1/admin/lots/{id}", {
        params: { path: { id } },
        body: { status },
      });
      return toSubmitOutcome(response.status, error, null);
    },
    onSuccess: (outcome) => {
      if (outcome.kind === "done") void queryClient.invalidateQueries({ queryKey: LOTS_KEY });
    },
  });
}

// Alta de titular (con lote) o de guardia (sin lote). El backend crea el
// usuario en PENDING_ACTIVATION y le manda el mail de activacion; si el DNI
// ya existe, reusa el usuario y suma el permiso.
export function useOnboardUser() {
  return useMutation({
    mutationFn: async ({
      input,
      role,
      lotId,
    }: {
      input: OnboardInput;
      role: OnboardRole;
      lotId: string | null;
    }): Promise<SubmitOutcome> => {
      const { error, response } = await api.POST("/api/v1/admin/users", {
        body: {
          fullName: input.fullName.trim(),
          dni: input.dni.trim(),
          email: input.email.trim(),
          role,
          ...(lotId ? { lotId } : {}),
        },
      });
      return toSubmitOutcome(response.status, error, null);
    },
  });
}

// US-09 (#214): codigo (en mayusculas) -> id de todos los lotes del barrio,
// para marcar en el preview los que ya existen. Pagina hasta que una venga
// incompleta: el endpoint no devuelve total.
export function useAllLotCodes(enabled: boolean) {
  return useQuery({
    queryKey: [...LOTS_KEY, "all-codes"],
    enabled,
    queryFn: async () => {
      const codes = new Map<string, string>();
      for (let page = 0; ; page++) {
        const { data, response } = await api.GET("/api/v1/admin/lots", { params: { query: { page } } });
        if (!response.ok || !data) throw new Error(`Lots HTTP ${response.status}`);
        for (const lot of data) codes.set(lot.code.toUpperCase(), lot.id);
        if (data.length < LOTS_PAGE_SIZE) return codes;
      }
    },
  });
}

async function importRow(row: ImportRow, existingId: string | undefined): Promise<ImportResultRow> {
  let lotId = existingId;
  if (!lotId) {
    const street = blank(row.street);
    const number = blank(row.number);
    const { data, error, response } = await api.POST("/api/v1/admin/lots", {
      body: { code: row.code, ...(street ? { street } : {}), ...(number ? { number } : {}) },
    });
    const outcome = toSubmitOutcome(response.status, error, "Ya hay un lote con ese código en el barrio.");
    if (outcome.kind !== "done" || !data) {
      return { line: row.line, code: row.code, ok: false, message: outcomeMessage(outcome) };
    }
    lotId = data.id;
  }
  if (!row.owner) return { line: row.line, code: row.code, ok: true, message: existingId ? "El lote ya existía." : "Lote creado." };
  const { error, response } = await api.POST("/api/v1/admin/users", {
    body: {
      fullName: row.owner.fullName,
      dni: row.owner.dni,
      email: row.owner.email,
      role: "RESIDENT_OWNER",
      lotId,
    },
  });
  const outcome = toSubmitOutcome(response.status, error, null);
  if (outcome.kind !== "done") {
    return { line: row.line, code: row.code, ok: false, message: `Lote listo, titular no: ${outcomeMessage(outcome)}` };
  }
  return { line: row.line, code: row.code, ok: true, message: "Lote y titular listos. Le enviamos el mail de activación." };
}

function outcomeMessage(outcome: SubmitOutcome): string {
  if (outcome.kind === "error") return outcome.message;
  if (outcome.kind === "invalid") return Object.values(outcome.fields).join(" ");
  return "";
}

// Fila por fila, en orden: un error en una no corta las demas. Sin red, la
// fila falla con el mensaje del cliente y el resto sigue intentando.
export function useImportRegistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rows, existing }: { rows: ImportRow[]; existing: ReadonlyMap<string, string> }) => {
      const results: ImportResultRow[] = [];
      for (const row of rows) {
        try {
          results.push(await importRow(row, existing.get(row.code.toUpperCase())));
        } catch {
          results.push({ line: row.line, code: row.code, ok: false, message: "Sin conexión con el servidor." });
        }
      }
      return results;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: LOTS_KEY }),
  });
}
