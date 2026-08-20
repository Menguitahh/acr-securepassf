import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '@securepass/contracts';

import { api, authRequest } from '@/common/api/client';
import { createInvitationErrorMessage } from '@/modules/invitation/lib';

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

export function useMyPasses() {
  return useQuery({
    queryKey: ['passes', 'me'],
    queryFn: async () => {
      const { data, error } = await authRequest(() => api.GET('/api/v1/me/passes'));
      if (error || !data) {
        throw new Error('No se pudo cargar tu pase personal.');
      }
      return data.passes ?? [];
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
        throw new Error(createInvitationErrorMessage(error));
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}
