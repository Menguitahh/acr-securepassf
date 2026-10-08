"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/common/api/client";
import { toLotRows, toSubmitOutcome } from "@/modules/registry/lib";
import type { LotInput, LotStatus, OnboardInput, OnboardRole, SubmitOutcome } from "@/modules/registry/types";

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
