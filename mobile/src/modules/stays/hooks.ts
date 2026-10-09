import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/common/api/client';
import { getNotifications } from '@/common/notifications/safe';
import { GATE_ID } from '@/modules/scanner/data';
import { STAYS_REFRESH_MS } from '@/modules/stays/data';
import { syncStayWarnings } from '@/modules/stays/notifications';
import type { Stay } from '@/modules/stays/types';
import { forgetWarning } from '@/modules/stays/warnings-store';

export function useOpenStays() {
  return useQuery({
    queryKey: ['stays', 'open'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/stays/open');
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
      const { data, error } = await api.POST('/api/v1/stays/{id}/close', {
        params: { path: { id: stayId } },
        body: { gateId },
      });
      if (error || !data) throw new Error('No se pudo cerrar la estadia. Reintentá cuando vuelva la red.');
      return { stayId, data };
    },
    onSuccess: ({ stayId }) => {
      // Cerrada la estadia, no tiene sentido que dispare el aviso.
      const notifId = forgetWarning(stayId);
      if (notifId) {
        void (async () => {
          const N = await getNotifications();
          if (!N) return;
          await N.cancelScheduledNotificationAsync(notifId).catch(() => {});
        })();
      }
      void queryClient.invalidateQueries({ queryKey: ['stays', 'open'] });
    },
  });
}

// Cada vez que cambia la lista de stays abiertos, se reconcilian las
// notificaciones locales: se programan las que faltan y se cancelan
// las de stays que ya no estan abiertos. No depende de red: el trigger
// vive en el dispositivo.
export function useSyncStayWarnings(stays: readonly Stay[] | undefined): void {
  useEffect(() => {
    if (!stays) return;
    void syncStayWarnings(stays, Date.now());
  }, [stays]);
}
