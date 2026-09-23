"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/common/api/client";
import { OVERVIEW_REFETCH_MS, OVERVIEW_STALE_MS } from "@/modules/overview/data";
import { toOverview } from "@/modules/overview/lib";

export function useOverview() {
  return useQuery({
    queryKey: ["metrics", "overview"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/metrics/overview");
      if (!response.ok || !data) throw new Error(`Overview HTTP ${response.status}`);
      return toOverview(data);
    },
    refetchInterval: OVERVIEW_REFETCH_MS,
    staleTime: OVERVIEW_STALE_MS,
  });
}
