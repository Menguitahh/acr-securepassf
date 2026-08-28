import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '@securepass/contracts';

import { api, authRequest } from '@/common/api/client';
import { isProblemDetail } from '@/common/api/problem';

// El server manda problem+json con `detail` legible ("el usuario ya es
// miembro del lote", "usuario no encontrado"): ese mensaje es el que va
// a la UI, no un error generico.
function serverDetail(error: unknown, fallback: string): string {
  if (isProblemDetail(error)) return error.detail ?? fallback;
  return fallback;
}

export function useFamilyMembers(lotId: string | undefined) {
  return useQuery({
    queryKey: ['family', lotId],
    enabled: lotId !== undefined,
    queryFn: async () => {
      const { data, error } = await authRequest(() =>
        api.GET('/api/v1/family/lots/{lotId}/members', {
          params: { path: { lotId: lotId ?? '' } },
        }),
      );
      if (error || !data) {
        throw new Error('No se pudo cargar la unidad familiar.');
      }
      return data;
    },
  });
}

// WBS-110: el contrato v2 pide {fullName, dni, birthDate, email?, relation?, canInvite}
// y devuelve un `outcome` (CREATED_USER_AND_PERMISSION | ADDED_PERMISSION |
// REACTIVATED_PERMISSION | ALREADY_MEMBER) que el frontend usa para mostrar el
// mensaje correcto: crear cuenta, sumar al lote o reactivar a alguien dado de
// baja. Este hook compila contra el tipo v2; la reescritura de la UI (input
// unico por email/telefono -> formulario con edad ramificando + parentesco +
// canInvite explicito + mensajes por outcome) queda para WBS-113.
export function useAddFamilyMember(lotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: components['schemas']['AddFamilyMemberRequest']) => {
      const { data, error } = await authRequest(() =>
        api.POST('/api/v1/family/lots/{lotId}/members', {
          params: { path: { lotId } },
          body: input,
        }),
      );
      if (error || !data) {
        throw new Error(
          serverDetail(error, 'No se pudo agregar el miembro. Revisá los datos e intentá de nuevo.'),
        );
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['family'] });
    },
  });
}

export function useUpdateFamilyMember(lotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      patch: components['schemas']['UpdateFamilyMemberRequest'];
    }) => {
      const { data, error } = await authRequest(() =>
        api.PATCH('/api/v1/family/lots/{lotId}/members/{userId}', {
          params: { path: { lotId, userId: input.userId } },
          body: input.patch,
        }),
      );
      if (error || !data) {
        throw new Error(serverDetail(error, 'No se pudo actualizar el miembro. Intentá de nuevo.'));
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['family'] });
    },
  });
}
