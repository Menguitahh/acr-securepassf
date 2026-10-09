import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '@securepass/contracts';

import { api } from '@/common/api/client';
import { isProblemDetail } from '@/common/api/problem';

/**
 * WBS-113: hooks del padron de menores. Consume los cuatro endpoints de
 * WBS-111. La UI que los usa se arma en el PR siguiente
 * (feature/family-management-screen); estos hooks se testean por su tipo
 * y compilan solos.
 *
 * Invalidacion: 'family-minors' es la key propia; 'family' se invalida
 * ademas en graduate porque la operacion crea un familiar nuevo.
 */

function serverDetail(error: unknown, fallback: string): string {
  if (isProblemDetail(error)) return error.detail ?? fallback;
  return fallback;
}

export function useMinors(lotId: string | undefined) {
  return useQuery({
    queryKey: ['family-minors', lotId],
    enabled: lotId !== undefined,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/family/lots/{lotId}/minors', {
        params: { path: { lotId: lotId ?? '' } },
      });
      if (error || !data) {
        throw new Error('No se pudo cargar el padrón de menores.');
      }
      return data;
    },
  });
}

export function useRegisterMinor(lotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: components['schemas']['RegisterMinorRequest']) => {
      const { data, error } = await api.POST('/api/v1/family/lots/{lotId}/minors', {
        params: { path: { lotId } },
        body: input,
      });
      if (error || !data) {
        throw new Error(
          serverDetail(error, 'No se pudo registrar el menor. Revisá los datos e intentá de nuevo.'),
        );
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['family-minors', lotId] });
    },
  });
}

export function useDeleteMinor(lotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (minorId: string) => {
      const { error } = await api.DELETE('/api/v1/family/lots/{lotId}/minors/{minorId}', {
        params: { path: { lotId, minorId } },
      });
      if (error) {
        throw new Error(serverDetail(error, 'No se pudo dar de baja al menor.'));
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['family-minors', lotId] });
    },
  });
}

export function useGraduateMinor(lotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      minorId: string;
      body: components['schemas']['GraduateMinorRequest'];
    }) => {
      const { data, error } = await api.POST('/api/v1/family/lots/{lotId}/minors/{minorId}/graduate', {
        params: { path: { lotId, minorId: input.minorId } },
        body: input.body,
      });
      if (error || !data) {
        throw new Error(
          serverDetail(error, 'No se pudo graduar al menor. Revisá los datos e intentá de nuevo.'),
        );
      }
      return data;
    },
    onSuccess: () => {
      // Graduate afecta ambas listas: el menor sale del padron y aparece
      // en familiares.
      void queryClient.invalidateQueries({ queryKey: ['family-minors', lotId] });
      void queryClient.invalidateQueries({ queryKey: ['family', lotId] });
    },
  });
}
