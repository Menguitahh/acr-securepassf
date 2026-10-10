import { useQuery } from '@tanstack/react-query';

import { api } from '@/common/api/client';

const SHIFT_LOG_REFRESH_MS = 30_000;

// US-72: ingresos y egresos del turno abierto del guardia (50 mas recientes).
export function useShiftLog() {
  return useQuery({
    queryKey: ['access-logs', 'shift'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/access-logs/shift');
      if (error || !data) throw new Error('No se pudo cargar el registro del turno.');
      return data.items ?? [];
    },
    refetchInterval: SHIFT_LOG_REFRESH_MS,
    networkMode: 'offlineFirst',
  });
}
