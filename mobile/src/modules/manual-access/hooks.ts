import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { components } from '@securepass/contracts';

import { api } from '@/common/api/client';
import type { LotSuggestion } from '@/modules/manual-access/types';

const AUTOCOMPLETE_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 1;

export function useLotSearch(query: string) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), AUTOCOMPLETE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  return useQuery({
    queryKey: ['lots', 'search', debounced],
    enabled: debounced.trim().length >= MIN_QUERY_LENGTH,
    queryFn: async (): Promise<LotSuggestion[]> => {
      const { data, error } = await api.GET('/api/v1/lots', { params: { query: { q: debounced.trim() } } });
      if (error || !data) throw new Error('No se pudo buscar lotes.');
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useManualAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: components['schemas']['ManualAccessRequest']) => {
      const { data, error } = await api.POST('/api/v1/access/manual', { body: payload });
      if (error || !data) throw new Error('El server rechazo el ingreso manual. Revisá los datos o reintentá.');
      return data;
    },
    onSuccess: () => {
      // Un ingreso manual entra en la lista de presentes.
      void queryClient.invalidateQueries({ queryKey: ['stays', 'open'] });
    },
  });
}
