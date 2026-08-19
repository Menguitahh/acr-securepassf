import { useCallback, useState } from 'react';

import { api, authRequest } from '@/common/api/client';
import { isProblemDetail } from '@/common/api/problem';
import { wipeLocalDatabase } from '@/common/db/database';
import { hasRole, toSessionUser } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';
import {
  clearSession,
  loadTokens,
  saveSession,
} from '@/modules/auth/session-storage';

export function useLogin() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (identifier: string, password: string): Promise<boolean> => {
      setIsPending(true);
      setError(null);
      try {
        const { data, error } = await api.POST('/api/v1/auth/login', {
          body: { identifier, password },
        });
        if (error || !data.accessToken || !data.refreshToken) {
          const rawError: unknown = error;
          const problem = isProblemDetail(rawError) ? rawError : null;
          setError(
            problem?.status === 401
              ? 'Credenciales incorrectas.'
              : 'No se pudo conectar con el servidor. Revisá tu conexion.',
          );
          return false;
        }
        const user = data.user ? toSessionUser(data.user) : null;
        if (!user) {
          setError('El servidor devolvió una sesion incompleta. Intentá de nuevo.');
          return false;
        }
        await saveSession(
          { accessToken: data.accessToken, refreshToken: data.refreshToken },
          user,
        );
        useSessionStore.getState().signIn(user);
        return true;
      } catch {
        setError('No se pudo conectar con el servidor. Revisá tu conexion.');
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [],
  );

  return { login, isPending, error };
}

export function useLogout() {
  return useCallback(async () => {
    const tokens = await loadTokens();
    if (tokens) {
      try {
        await authRequest(() =>
          api.POST('/api/v1/auth/logout', {
            body: { refreshToken: tokens.refreshToken },
          }),
        );
      } catch {
        // El logout local avanza aunque el server no responda.
      }
    }
    const user = useSessionStore.getState().user;
    if (user && hasRole(user, 'GUARD')) {
      wipeLocalDatabase();
    }
    await clearSession();
    useSessionStore.getState().signOut();
  }, []);
}
