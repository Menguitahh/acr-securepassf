import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '@securepass/contracts';

import { api, authRequest } from '@/common/api/client';

export function useActiveInvitations() {
  return useQuery({
    queryKey: ['invitations', 'active'],
    queryFn: async () => {
      const { data, error } = await authRequest(() =>
        api.GET('/api/v1/invitations', { params: { query: { status: 'ACTIVE' } } }),
      );
      if (error || !data) {
        throw new Error('No se pudo cargar la lista de pases.');
      }
      return data.items ?? [];
    },
  });
}

export function useInvitation(id: string | undefined) {
  return useQuery({
    queryKey: ['invitation', id],
    enabled: id !== undefined,
    queryFn: async () => {
      const { data, error } = await authRequest(() =>
        api.GET('/api/v1/invitations/{id}', { params: { path: { id: id ?? '' } } }),
      );
      if (error || !data) throw new Error('No se pudo cargar el pase.');
      return data;
    },
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: components['schemas']['CreateInvitationRequest']) => {
      const { data, error } = await authRequest(() =>
        api.POST('/api/v1/invitations', { body: payload }),
      );
      if (error || !data) {
        throw new Error('El server rechazó la invitación. Revisá los datos.');
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}
