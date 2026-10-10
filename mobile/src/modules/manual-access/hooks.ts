import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/common/api/client';
import { readLastKnown, rememberLastKnown } from '@/common/query/last-known';
import { parseStoredLots } from '@/modules/manual-access/lib';
import type { LotSuggestion, ManualAccessOutcome, ManualAccessRequest } from '@/modules/manual-access/types';
import { enqueueManual } from '@/modules/offline/manual-queue';
import { useOfflineStore } from '@/modules/offline/offline-store';

const LAST_LOTS = 'lots.active';

// WBS-36: los lotes activos del barrio se guardan en el telefono (#204) para
// elegir el destino sin red. El autocompletado filtra esta lista.
export function useActiveLots() {
  return useQuery({
    queryKey: ['lots', 'active'],
    queryFn: async (): Promise<LotSuggestion[]> => {
      const { data, error } = await api.GET('/api/v1/lots/active');
      if (error || !data) throw new Error('No se pudo cargar la lista de lotes.');
      rememberLastKnown(LAST_LOTS, data);
      return data;
    },
    initialData: () => parseStoredLots(readLastKnown(LAST_LOTS)),
    initialDataUpdatedAt: 0,
    networkMode: 'offlineFirst',
  });
}

export function useManualAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ManualAccessRequest): Promise<ManualAccessOutcome> => {
      const sent = { subjectName: payload.subjectName, subjectDocument: payload.subjectDocument };
      try {
        const { data, error } = await api.POST('/api/v1/access/manual', { body: payload });
        if (error || !data) throw new ServerRejected();
        return { kind: 'sent', ...sent };
      } catch (err) {
        if (err instanceof ServerRejected) {
          throw new Error('El server rechazo el ingreso manual. Revisá los datos o reintentá.');
        }
        // Sin red: queda en la cola y se manda al volver (mismo clientEventId).
        enqueueManual(payload);
        useOfflineStore.getState().refreshPendingCount();
        return { kind: 'queued', ...sent };
      }
    },
    onSuccess: () => {
      // Un ingreso manual entra en la lista de presentes.
      void queryClient.invalidateQueries({ queryKey: ['stays', 'open'] });
    },
  });
}

class ServerRejected extends Error {}
