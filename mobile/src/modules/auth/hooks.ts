import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { api, authRequest } from '@/common/api/client';
import { isProblemDetail } from '@/common/api/problem';
import { hasRole, toSessionUser } from '@/modules/auth/lib';
import { resolveOutboxFlush, type FlushDecision, type LogoutOutcome } from '@/modules/auth/logout';
import { useSessionStore } from '@/modules/auth/session-store';
import {
  clearSession,
  loadTokens,
  saveSession,
} from '@/modules/auth/session-storage';
import { countPendingEvents } from '@/modules/offline/outbox';
import { syncOutbox } from '@/modules/offline/sync';

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
              ? 'Credenciales incorrectas. Revisá el email y la contraseña.'
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

function promptOutboxDecision(pending: number): Promise<FlushDecision> {
  const label = pending === 1 ? 'ingreso sin sincronizar' : 'ingresos sin sincronizar';
  return new Promise((resolve) => {
    Alert.alert(
      `Hay ${pending} ${label}`,
      'Si cerrás sesión ahora, van a quedar en la cola local hasta que el próximo guardia sincronice — y ese guardia va a aparecer como responsable en la bitácora.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'Reintentar', onPress: () => resolve('retry') },
        {
          text: 'Cerrar sesión igual',
          style: 'destructive',
          onPress: () => resolve('proceed'),
        },
      ],
      { cancelable: false },
    );
  });
}

// Cierra sesion del guardia preservando el outbox (los eventos son de la
// garita, no del guardia). Si hay eventos sin sincronizar, intenta un
// ultimo drain con timeout; si quedan, pregunta al guardia como seguir.
//
// NO llama wipeLocalDatabase: la data local es gate-scoped y persiste
// entre guardias. Wipe al cambiar de barrio se hace en el login (#121).
//
// Retorna 'cancelled' si el guardia aborto en el prompt: caller debe
// dejarlo en la pantalla actual sin limpiar sesion.
export function useLogout(): () => Promise<LogoutOutcome> {
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
      const outcome = await resolveOutboxFlush({
        syncOutbox,
        countPending: countPendingEvents,
        promptDecision: promptOutboxDecision,
      });
      if (outcome === 'cancelled') return 'cancelled';
    }

    try {
      await clearSession();
    } catch {
      // Si el storage falla, forzamos signOut en memoria: mejor una sesion
      // volatil que el guardia trabado. El proximo boot re-hidrata desde
      // storage — si sigue roto, sale al login por sesion inexistente.
    }
    useSessionStore.getState().signOut();
    return 'closed';
  }, []);
}
