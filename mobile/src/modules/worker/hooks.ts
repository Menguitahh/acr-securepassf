import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '@securepass/contracts';

import { api, authRequest } from '@/common/api/client';
import { isProblemDetail } from '@/common/api/problem';

function serverDetail(error: unknown, fallback: string): string {
  if (isProblemDetail(error)) return error.detail ?? fallback;
  return fallback;
}

export function useWorkers(lotId: string | undefined) {
  return useQuery({
    queryKey: ['workers', lotId],
    enabled: lotId !== undefined,
    queryFn: async () => {
      const { data, error } = await authRequest(() =>
        api.GET('/api/v1/lots/{lotId}/workers', {
          params: { path: { lotId: lotId ?? '' } },
        }),
      );
      if (error || !data) {
        throw new Error('No se pudo cargar la lista de trabajadores.');
      }
      return data;
    },
  });
}

export function useAddWorker(lotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: components['schemas']['AddWorkerRequest']) => {
      const { data, error } = await authRequest(() =>
        api.POST('/api/v1/lots/{lotId}/workers', {
          params: { path: { lotId } },
          body: input,
        }),
      );
      if (error || !data) {
        throw new Error(
          serverDetail(error, 'No se pudo habilitar el trabajador. Revisá los datos e intentá de nuevo.'),
        );
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workers', lotId] });
    },
  });
}
