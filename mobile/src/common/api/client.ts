import createClient from 'openapi-fetch';
import type { paths } from '@securepass/contracts';

import { API_BASE_URL } from '@/modules/auth/data';
import { clearSession, loadTokens, saveTokens } from '@/modules/auth/session-storage';

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
    super('La sesion expiro.');
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
