import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, authRequest } from '@/common/api/client';
import { GATE_ID } from '@/modules/scanner/data';
import type { Shift } from '@/modules/shifts/types';

const SHIFTS_KEY = ['shifts', 'current'] as const;

export function useCurrentShift() {
  return useQuery({
    queryKey: SHIFTS_KEY,
    queryFn: async (): Promise<Shift | null> => {
      const { data, error, response } = await authRequest(() =>
        api.GET('/api/v1/shifts/current'),
      );
      // Sin turno abierto es estado valido, no error. Contract drift:
      // el backend hoy devuelve 200-empty, el contrato declara solo 200
      // con ShiftResponse, y no hay acuerdo sobre 204 vs 404. Se toleran
      // los tres (204, 404 y 200 sin body) para que el dia que el server
      // se alinee al contrato correcto el cliente no se rompa de nuevo.
      // Deuda: alinear server + contrato (issue #96). Hasta entonces, un
      // guardia con "sin turno" tiene que caer a ClosedShiftView con
      // boton "Abrir turno", nunca al error state.
      if (response.status === 404 || response.status === 204 || !data) return null;
      if (error) throw new Error('No se pudo cargar el turno actual.');
      return data;
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
      const { data, error } = await authRequest(() =>
        api.POST('/api/v1/shifts/open', {
          body: handoverNotes
            ? { gateId, handoverNotes }
            : { gateId },
        }),
      );
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
      const { data, error } = await authRequest(() =>
        api.POST('/api/v1/shifts/close', {
          body: handoverNotes ? { handoverNotes } : {},
        }),
      );
      if (error || !data) throw new Error('No se pudo cerrar el turno. Reintentá en unos segundos.');
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData(SHIFTS_KEY, null);
    },
  });
}
