"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/common/api/client";
import { OVERSTAYS_REFETCH_MS } from "@/modules/overstays/data";
import { toOverstayRows } from "@/modules/overstays/lib";

export function useOverstays() {
  return useQuery({
    queryKey: ["metrics", "overstays"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/metrics/overstays");
      if (!response.ok || !data) throw new Error(`Overstays HTTP ${response.status}`);
      return toOverstayRows(data.items ?? []);
    },
    refetchInterval: OVERSTAYS_REFETCH_MS,
  });
}
