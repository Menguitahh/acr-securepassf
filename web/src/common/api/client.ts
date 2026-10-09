import createClient from "openapi-fetch";
import type { paths } from "@securepass/contracts";

import { publicApi } from "@/common/api/public-client";
import { API_BASE_URL } from "@/modules/auth/data";
import { isAdmin, toSessionUser } from "@/modules/auth/lib";
import { endSession, revokeRemote } from "@/modules/auth/session";
import { loadAccessToken, loadRefreshToken, saveSession, saveTokens } from "@/modules/auth/session-storage";

export class SessionEndedError extends Error {
  constructor() {
    super("La sesión terminó. Ingresá de nuevo para seguir.");
  }
}

async function refresh(): Promise<string> {
  const refreshToken = loadRefreshToken();
  if (!refreshToken) {
    endSession("expired");
    throw new SessionEndedError();
  }

  // Error de red: publicApi rechaza y se propaga sin tocar la sesion. El
  // refresh sigue siendo valido; cuando vuelva el server, el proximo 401
  // lo usa. Solo un rechazo explicito del server termina la sesion.
  const { data, response } = await publicApi.POST("/api/v1/auth/refresh", {
    body: { refreshToken },
  });
  if (response.status === 400 || response.status === 401) {
    endSession("expired");
    throw new SessionEndedError();
  }
  if (!data?.accessToken || !data.refreshToken) {
    throw new Error(`Refresh sin tokens (HTTP ${response.status})`);
  }

  const tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken };
  const user = data.user ? toSessionUser(data.user) : null;
  if (user && !isAdmin(user)) {
    await revokeRemote(tokens);
    endSession("notAdmin");
    throw new SessionEndedError();
  }
  if (user) saveSession(tokens, user);
  else saveTokens(tokens);
  return tokens.accessToken;
}

// Single-flight: el refresh rota el token y el backend revoca la familia
// entera si ve uno ya rotado. Dos refresh en paralelo = sesion muerta
// (#131). Todos los 401 simultaneos esperan esta misma promesa.
let inFlight: Promise<string> | null = null;

function refreshOnce(): Promise<string> {
  inFlight ??= refresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function withBearer(request: Request, token: string | null): Request {
  if (token && !request.headers.has("Authorization")) {
    request.headers.set("Authorization", `Bearer ${token}`);
  }
  return request;
}

async function authFetch(request: Request): Promise<Response> {
  const sentWith = loadAccessToken();
  // El body de un Request se lee una sola vez: el reintento sale del clon.
  const retry = request.clone();
  const response = await fetch(withBearer(request, sentWith));
  if (response.status !== 401) return response;

  // 401 tardio: otro request ya refresco mientras este viajaba con el
  // access viejo. Reintentar con el actual, sin gastar otro refresh.
  const current = loadAccessToken();
  const token = current && current !== sentWith ? current : await refreshOnce();

  // Un solo reintento. Si vuelve 401, el access recien emitido no alcanza
  // y seguir refrescando seria un loop.
  const retried = await fetch(withBearer(retry, token));
  if (retried.status === 401) {
    endSession("expired");
    throw new SessionEndedError();
  }
  return retried;
}

// Toda llamada autenticada pasa por aca: no hay forma de olvidarse del
// refresh, a diferencia de un wrapper opcional por call.
export const api = createClient<paths>({ baseUrl: API_BASE_URL, fetch: authFetch });
