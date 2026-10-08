"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/common/api/client";
import { SHIFTS_REFETCH_MS } from "@/modules/shifts/data";
import { toShiftPage } from "@/modules/shifts/lib";

export function useShifts(page: number) {
  return useQuery({
    queryKey: ["shifts", page],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/shifts", { params: { query: { page } } });
      if (!response.ok || !data) throw new Error(`Shifts HTTP ${response.status}`);
      return toShiftPage(data);
    },
    // La pagina anterior queda visible mientras llega la nueva: sin parpadeo.
    placeholderData: keepPreviousData,
    // Solo la primera se refresca sola. En las siguientes, un turno nuevo
    // correria las filas mientras el admin lee.
    refetchInterval: page === 0 ? SHIFTS_REFETCH_MS : false,
  });
}
