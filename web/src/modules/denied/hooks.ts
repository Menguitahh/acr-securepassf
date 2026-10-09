"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/common/api/client";
import { toDenialRows } from "@/common/denials/lib";
import type { DenialReason } from "@/common/denials/types";
import { toDeniedLogPage } from "@/modules/denied/lib";

export function useDenialCounts(date: string) {
  return useQuery({
    queryKey: ["metrics", "overview", date],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/metrics/overview", { params: { query: { date } } });
      if (!response.ok || !data) throw new Error(`Overview HTTP ${response.status}`);
      return toDenialRows(data.denialsByReason ?? {});
    },
  });
}

export function useDeniedLogs(from: string, to: string, reason: DenialReason, page: number) {
  return useQuery({
    queryKey: ["access-logs", "denied", from, to, reason, page],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/access-logs", {
        params: { query: { from, to, result: "DENIED", reason, page } },
      });
      if (!response.ok || !data) throw new Error(`Access logs HTTP ${response.status}`);
      return toDeniedLogPage(data);
    },
    // La pagina anterior queda visible mientras llega la nueva: sin parpadeo.
    placeholderData: keepPreviousData,
  });
}
