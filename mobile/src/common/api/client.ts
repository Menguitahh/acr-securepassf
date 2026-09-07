import createClient from 'openapi-fetch';
import type { paths } from '@securepass/contracts';

import { API_BASE_URL } from '@/modules/auth/data';
import { toSessionUser } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';
import {
  clearSession,
  loadTokens,
  saveTokens,
  saveUser,
} from '@/modules/auth/session-storage';

export const api = createClient<paths>({ baseUrl: API_BASE_URL });

api.use({
  async onRequest({ request }) {
    const tokens = await loadTokens();
    if (tokens) {
      request.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    }
    return request;
  },
});

export class SessionExpiredError extends Error {
  constructor() {
    super('La sesion expiro. Volvé a iniciar sesion.');
  }
}

export async function refreshSession(): Promise<void> {
  const tokens = await loadTokens();
  if (!tokens) throw new SessionExpiredError();

  const { data, error } = await api.POST('/api/v1/auth/refresh', {
    body: { refreshToken: tokens.refreshToken },
  });
  if (error || !data.accessToken || !data.refreshToken) {
    await clearSession();
    throw new SessionExpiredError();
  }
  await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  // El backend incluye user en /auth/refresh desde securepassb#155 para
  // propagar neighborhoodTimezone (y cualquier futuro cambio del perfil)
  // sin exigir re-login. Si el server responde sin user, se conserva el
  // ya persistido para no romper sesiones antiguas.
  if (data.user) {
    const user = toSessionUser(data.user);
    if (user) {
      await saveUser(user);
      useSessionStore.getState().signIn(user);
    }
  }
}

type ApiResult = { error?: { status?: number } | undefined };

export async function authRequest<T extends ApiResult>(
  request: () => Promise<T>,
): Promise<T> {
  const result = await request();
  if (result.error?.status !== 401) return result;

  await refreshSession();
  return request();
}
