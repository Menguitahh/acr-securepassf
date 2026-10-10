import createClient from 'openapi-fetch';
import type { paths } from '@securepass/contracts';

import { API_BASE_URL } from '@/modules/auth/data';
import { toSessionUser } from '@/modules/auth/lib';
import { endSession } from '@/modules/auth/session';
import { useSessionStore } from '@/modules/auth/session-store';
import { loadTokens, saveTokens, saveUser } from '@/modules/auth/session-storage';

export class SessionExpiredError extends Error {
  constructor() {
    super('La sesión expiró. Volvé a iniciar sesión.');
  }
}

// Sin red, fetch rechaza con el texto crudo de la plataforma ("fetch failed:
// java.io.IOException..."). Las vistas muestran error.message: se reemplaza
// por uno para el guardia. Quien distingue "sin red" sigue con su catch.
export class NetworkError extends Error {
  constructor() {
    super('Sin conexión con el servidor.');
  }
}

function send(request: Request): Promise<Response> {
  return fetch(request).catch(() => {
    throw new NetworkError();
  });
}

// Sin Bearer ni retry: el refresh no puede disparar otro refresh.
const publicApi = createClient<paths>({ baseUrl: API_BASE_URL, fetch: send });

// Login y refresh son publicos: ni Bearer (uno vencido puede hacer que el
// filtro JWT rechace el request) ni refresh ante un 401 (un 401 del login
// son credenciales malas, no un access vencido).
const PUBLIC_AUTH_PATHS = ['/api/v1/auth/login', '/api/v1/auth/refresh'];

function isPublicAuth(request: Request): boolean {
  return PUBLIC_AUTH_PATHS.some((path) => request.url.endsWith(path));
}

async function loadAccessToken(): Promise<string | null> {
  return (await loadTokens())?.accessToken ?? null;
}

async function refresh(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) {
    await endSession('expired');
    throw new SessionExpiredError();
  }

  // Error de red: publicApi rechaza y se propaga sin tocar la sesion. Solo
  // un rechazo explicito del server la termina. Un 5xx (deploy, Redis
  // caido) tampoco: el refresh sigue siendo valido (#131, parte 3).
  const { data, response } = await publicApi.POST('/api/v1/auth/refresh', {
    body: { refreshToken: tokens.refreshToken },
  });
  if (response.status === 400 || response.status === 401) {
    await endSession('expired');
    throw new SessionExpiredError();
  }
  if (!data?.accessToken || !data.refreshToken) {
    throw new Error(`Refresh sin tokens (HTTP ${response.status})`);
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
  return data.accessToken;
}

// Single-flight: el refresh rota el token y el backend revoca la familia
// entera si ve uno ya rotado. Dos refresh en paralelo = guardia afuera
// (#131). Todos los 401 simultaneos esperan esta misma promesa. Mismo
// diseno que web/src/common/api/client.ts (#126).
let inFlight: Promise<string> | null = null;

function refreshOnce(): Promise<string> {
  inFlight ??= refresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function withBearer(request: Request, token: string | null): Request {
  if (token && !request.headers.has('Authorization')) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
}

async function authFetch(request: Request): Promise<Response> {
  if (isPublicAuth(request)) return send(request);

  const sentWith = await loadAccessToken();
  // El body de un Request se lee una sola vez: el reintento sale del clon.
  const retry = request.clone();
  const response = await send(withBearer(request, sentWith));
  if (response.status !== 401) return response;

  // 401 tardio: otro request ya refresco mientras este viajaba con el
  // access viejo. Reintentar con el actual, sin gastar otro refresh.
  const current = await loadAccessToken();
  const token = current && current !== sentWith ? current : await refreshOnce();

  // Un solo reintento. Si vuelve 401, seguir refrescando seria un loop.
  const retried = await send(withBearer(retry, token));
  if (retried.status === 401) {
    await endSession('expired');
    throw new SessionExpiredError();
  }
  return retried;
}

// Toda llamada pasa por authFetch: no hay forma de olvidarse del refresh.
export const api = createClient<paths>({ baseUrl: API_BASE_URL, fetch: authFetch });

