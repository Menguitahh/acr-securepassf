import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/common/api/client';
import { GATE_ID } from '@/modules/scanner/data';
import { parseCurrentShift } from '@/modules/shifts/lib';
import type { Shift } from '@/modules/shifts/types';

const SHIFTS_KEY = ['shifts', 'current'] as const;

export function useCurrentShift() {
  return useQuery({
    queryKey: SHIFTS_KEY,
    queryFn: async (): Promise<Shift | null> => {
      const { data, error, response } = await api.GET('/api/v1/shifts/current');
      return parseCurrentShift(response.status, data, error);
    },
    networkMode: 'offlineFirst',
  });
}

export function useOpenShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (handoverNotes: string) => {
      const gateId = GATE_ID;
      if (!gateId) throw new Error('Falta la garita configurada en este dispositivo.');
      const { data, error } = await api.POST('/api/v1/shifts/open', {
        body: handoverNotes
          ? { gateId, handoverNotes }
          : { gateId },
      });
      if (error || !data) throw new Error('No se pudo abrir el turno. Revisá si ya hay uno abierto (BR-09).');
      return data;
    },
    onSuccess: (shift) => {
      queryClient.setQueryData(SHIFTS_KEY, shift);
    },
  });
}

export function useCloseShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (handoverNotes: string) => {
      const { data, error } = await api.POST('/api/v1/shifts/close', {
        body: handoverNotes ? { handoverNotes } : {},
      });
      if (error || !data) throw new Error('No se pudo cerrar el turno. Reintentá en unos segundos.');
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData(SHIFTS_KEY, null);
    },
  });
}
