import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/common/api/client';
import { readLastKnown, rememberLastKnown } from '@/common/query/last-known';
import { getNotifications } from '@/common/notifications/safe';
import { GATE_ID } from '@/modules/scanner/data';
import { STAYS_REFRESH_MS } from '@/modules/stays/data';
import { isResidentDecisionPush, parseStoredStays } from '@/modules/stays/lib';
import { syncStayWarnings } from '@/modules/stays/notifications';
import type { Stay } from '@/modules/stays/types';
import { forgetWarning } from '@/modules/stays/warnings-store';

const LAST_STAYS = 'stays.open';

export function useOpenStays() {
  return useQuery({
    queryKey: ['stays', 'open'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/stays/open');
      if (error || !data) throw new Error('No se pudo cargar la lista de presentes.');
      const stays = data.stays ?? [];
      rememberLastKnown(LAST_STAYS, stays);
      return stays;
    },
    // #208: sin red al arrancar, la ultima lista conocida. Se pide al server
    // igual al montar.
    initialData: () => parseStoredStays(readLastKnown(LAST_STAYS), Date.now()),
    // Vencido a proposito: dispara el fetch, y "ahora" para resaltar avisos
    // vencidos queda cerca de la hora real.
    initialDataUpdatedAt: () => Date.now() - STAYS_REFRESH_MS,
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

// WBS-70 / US-41: el guardia avisa al residente que invito que la visita
// esta por vencer. El server manda el push con nombre, hora de ingreso y
// minutos restantes, y registra resident_notified_at. Un aviso cada 10 min
// por estadia (429 con Retry-After).
export function useNotifyResident() {
  return useMutation({
    mutationFn: async (stayId: string): Promise<string> => {
      const { error, response } = await api.POST('/api/v1/stays/{id}/notify-resident', {
        params: { path: { id: stayId } },
      });
      if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After'));
        const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 10;
        throw new Error(`Ya avisaste hace poco. Podés volver a avisar en ${minutes} min.`);
      }
      if (response.status === 409) {
        throw new Error('La visita ya salió o no tiene un residente a quien avisar.');
      }
      if (error || !response.ok) {
        throw new Error('No se pudo avisar al residente. Revisá la conexión y reintentá.');
      }
      return stayId;
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

// #33: la decision del residente tiene que verse en la garita en menos de
// 5 s (US-42). El push de securepassb#168 llega al guardia en turno; con la
// app abierta se refresca Presentes en el momento, sin esperar el polling
// de 60 s. Solo development build (getNotifications null en Expo Go).
export function useRefreshOnResidentDecision(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    void (async () => {
      const N = await getNotifications();
      if (!N || cancelled) return;
      subscription = N.addNotificationReceivedListener((notification) => {
        if (isResidentDecisionPush(notification.request.content.data)) {
          void queryClient.invalidateQueries({ queryKey: ['stays', 'open'] });
        }
      });
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, queryClient]);
}
