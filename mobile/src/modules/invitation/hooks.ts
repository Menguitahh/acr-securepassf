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

export function useExtendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await authRequest(() =>
        api.POST('/api/v1/invitations/{id}/extend', {
          params: { path: { id: invitationId } },
        }),
      );
      if (error || !data) {
        // El server aplica el tope de extensiones (BR): cuando se
        // supera, la respuesta es un problem detail. Se leen los campos
        // del detalle para que el residente vea el motivo real.
        const problem = error as { detail?: string; title?: string } | null;
        const message =
          problem?.detail ??
          problem?.title ??
          'No se pudo extender el pase. Alcanzaste el tope de extensiones o el server rechazo la operacion.';
        throw new Error(message);
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['stays', 'open'] });
    },
  });
}

export function useRequestExit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await authRequest(() =>
        api.POST('/api/v1/invitations/{id}/request-exit', {
          params: { path: { id: invitationId } },
        }),
      );
      if (error || !data) {
        throw new Error('No se pudo enviar el aviso a la garita. Reintentá en unos segundos.');
      }
      return data;
    },
    onSuccess: () => {
      // La garita ve exitRequestedAt en el proximo refresh de /stays/open.
      void queryClient.invalidateQueries({ queryKey: ['stays', 'open'] });
    },
  });
}
