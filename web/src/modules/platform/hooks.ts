"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/common/api/client";
import { toCreateOutcome } from "@/modules/platform/lib";
import type { CreateOutcome, NewNeighborhoodInput } from "@/modules/platform/types";

const KEY = ["platform-neighborhoods"] as const;

export function useNeighborhoods() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/platform/neighborhoods");
      if (!response.ok || !data) throw new Error(`Neighborhoods HTTP ${response.status}`);
      return data;
    },
  });
}

export function useCreateNeighborhood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewNeighborhoodInput): Promise<CreateOutcome> => {
      const { data, error, response } = await api.POST("/api/v1/platform/neighborhoods", {
        body: {
          name: input.name.trim(),
          slug: input.slug,
          timezone: input.timezone,
          adminFullName: input.adminFullName.trim(),
          adminDni: input.adminDni.trim(),
          adminEmail: input.adminEmail.trim(),
        },
      });
      return toCreateOutcome(response.status, error, data?.neighborhoodId ?? null);
    },
    onSuccess: (outcome) => {
      if (outcome.kind === "done") void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
