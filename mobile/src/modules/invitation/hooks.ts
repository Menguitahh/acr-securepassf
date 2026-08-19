import { useQuery } from '@tanstack/react-query';

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
