import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';

import { api } from '@/common/api/client';
import { GATE_ID } from '@/modules/scanner/data';
import { useSessionStore } from '@/modules/auth/session-store';
import { parseCurrentShift, parseStoredShift } from '@/modules/shifts/lib';
import type { Shift } from '@/modules/shifts/types';

const SHIFTS_KEY = ['shifts', 'current'] as const;

// #204: el ultimo turno que confirmo el server, por guardia. Sin red al
// arrancar, el scanner sigue con este en vez de quedar trabado.
function storageKey(): string | null {
  const userId = useSessionStore.getState().user?.id;
  return userId ? `shifts.current.${userId}` : null;
}

function rememberShift(shift: Shift | null): void {
  const key = storageKey();
  if (key) Storage.setItemSync(key, JSON.stringify(shift));
}

function lastKnownShift(): Shift | null | undefined {
  const key = storageKey();
  return key ? parseStoredShift(Storage.getItemSync(key)) : undefined;
}

export function useCurrentShift() {
  return useQuery({
    queryKey: SHIFTS_KEY,
    queryFn: async (): Promise<Shift | null> => {
      const { data, error, response } = await api.GET('/api/v1/shifts/current');
      const shift = parseCurrentShift(response.status, data, error);
      rememberShift(shift);
      return shift;
    },
    initialData: lastKnownShift,
    // El guardado es viejo: se pide al server igual al montar.
    initialDataUpdatedAt: 0,
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
      rememberShift(shift);
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
      rememberShift(null);
      queryClient.setQueryData(SHIFTS_KEY, null);
    },
  });
}
