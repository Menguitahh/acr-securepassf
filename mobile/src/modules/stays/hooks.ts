import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, authRequest } from '@/common/api/client';
import { GATE_ID } from '@/modules/scanner/data';
import { STAYS_REFRESH_MS } from '@/modules/stays/data';

export function useOpenStays() {
  return useQuery({
    queryKey: ['stays', 'open'],
    queryFn: async () => {
      const { data, error } = await authRequest(() => api.GET('/api/v1/stays/open'));
      if (error || !data) throw new Error('No se pudo cargar la lista de presentes.');
      return data.stays ?? [];
    },
    // Cache indefinida para que la lista quede visible sin red; el
    // refetch por intervalo mantiene el dato fresco cuando hay conexion.
    // networkMode 'offlineFirst' evita que query invalide la cache al perder red.
    networkMode: 'offlineFirst',
    refetchInterval: STAYS_REFRESH_MS,
    staleTime: STAYS_REFRESH_MS,
  });
}

export function useCloseStay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stayId: string) => {
      const gateId = GATE_ID;
      if (!gateId) throw new Error('Falta la garita configurada en este dispositivo.');
      const { data, error } = await authRequest(() =>
        api.POST('/api/v1/stays/{id}/close', {
          params: { path: { id: stayId } },
          body: { gateId },
        }),
      );
      if (error || !data) throw new Error('No se pudo cerrar la estadia. Reintentá cuando vuelva la red.');
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stays', 'open'] });
    },
  });
}
