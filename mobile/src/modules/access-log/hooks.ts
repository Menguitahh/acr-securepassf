import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/common/api/client';
import { HISTORY_PAGE_SIZE } from '@/modules/access-log/data';
import type { HistoryFilter } from '@/modules/access-log/types';

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

// US-26: historial de accesos del lote del residente. El server ya limita a
// sus lotes y a los ultimos 90 dias; se pagina de a 25 con "Ver mas".
export function useLotHistory(filter: HistoryFilter) {
  return useInfiniteQuery({
    queryKey: ['access-logs', 'resident', filter],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await api.GET('/api/v1/access-logs', {
        params: { query: { page: pageParam, ...(filter === 'ALL' ? {} : { result: filter }) } },
      });
      if (error || !data) throw new Error('No se pudo cargar el historial.');
      return data;
    },
    getNextPageParam: (last, pages) =>
      (last.items?.length ?? 0) < HISTORY_PAGE_SIZE ? undefined : pages.length,
  });
}
