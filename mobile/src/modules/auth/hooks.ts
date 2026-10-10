import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { api } from '@/common/api/client';
import { isProblemDetail } from '@/common/api/problem';
import { wipeLocalDatabase } from '@/common/db/database';
import { WEB_ONLY_MESSAGE } from '@/modules/auth/data';
import { forgotPasswordError, hasRole, isWebOnlyAccount, toSessionUser } from '@/modules/auth/lib';
import { resolveOutboxFlush, type FlushDecision, type LogoutOutcome } from '@/modules/auth/logout';
import { resolveNeighborhoodSwitch } from '@/modules/auth/reassign';
import { endSession } from '@/modules/auth/session';
import { useSessionStore } from '@/modules/auth/session-store';
import {
  loadLastNeighborhood,
  loadTokens,
  saveLastNeighborhood,
  saveSession,
} from '@/modules/auth/session-storage';
import type { ReassignDecision } from '@/modules/auth/types';
import { countPendingEvents } from '@/modules/offline/outbox';
import { syncOutbox } from '@/modules/offline/sync';

function promptReassign(pending: number): Promise<ReassignDecision> {
  const label = pending === 1 ? 'ingreso sin sincronizar' : 'ingresos sin sincronizar';
  return new Promise((resolve) => {
    Alert.alert(
      'Este dispositivo era de otro barrio',
      `Tiene ${pending} ${label} del barrio anterior. Si lo reasignás, se borran: no se pueden mandar a este barrio.`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve('cancel') },
        {
          text: 'Reasignar dispositivo',
          style: 'destructive',
          onPress: () => resolve('reassign'),
        },
      ],
      { cancelable: false },
    );
  });
}

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
              : 'No se pudo conectar con el servidor. Revisá tu conexión.',
          );
          return false;
        }
        if (data.user && isWebOnlyAccount(data.user)) {
          setError(WEB_ONLY_MESSAGE);
          return false;
        }
        const user = data.user ? toSessionUser(data.user) : null;
        if (!user) {
          setError('El servidor devolvió una sesión incompleta. Intentá de nuevo.');
          return false;
        }
        // Antes de guardar la sesion: si el guardia cancela, no queda nada
        // que limpiar.
        const check = await resolveNeighborhoodSwitch(user.neighborhoodId, {
          loadLastNeighborhood,
          saveLastNeighborhood,
          countPending: countPendingEvents,
          wipeLocalDatabase,
          promptReassign,
        });
        if (check === 'cancelled') {
          setError('Ingreso cancelado. Sincronizá los ingresos pendientes en el barrio anterior antes de reasignar el dispositivo.');
          return false;
        }
        await saveSession(
          { accessToken: data.accessToken, refreshToken: data.refreshToken },
          user,
        );
        useSessionStore.getState().signIn(user);
        return true;
      } catch {
        setError('No se pudo conectar con el servidor. Revisá tu conexión.');
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
        await api.POST('/api/v1/auth/logout', {
          body: { refreshToken: tokens.refreshToken },
        });
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

    // #220: el mismo corte que la sesion vencida. Tambien limpia la cache de
    // queries: si no, el siguiente usuario del telefono veia los datos del
    // anterior (p. ej. las estadias de todo el barrio que cargo el guardia).
    // Si el storage falla, endSession igual corta en memoria.
    await endSession(null);
    return 'closed';
  }, []);
}

// US-53 (#212). Sin red, el mensaje es el del NetworkError del cliente.
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { response } = await api.POST('/api/v1/auth/forgot-password', { body: { email } });
      const message = forgotPasswordError(response.status);
      if (message) throw new Error(message);
    },
  });
}
