"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/common/api/client";
import { fillHourlyBuckets } from "@/modules/traffic/lib";
import type { InstantRange } from "@/common/date-range/types";

export function useTraffic(range: InstantRange) {
  return useQuery({
    queryKey: ["metrics", "traffic", range.from, range.to],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/metrics/traffic", {
        params: { query: { from: range.from, to: range.to } },
      });
      if (!response.ok || !data) throw new Error(`Traffic HTTP ${response.status}`);
      return fillHourlyBuckets(range.from, range.to, data.buckets);
    },
  });
}
