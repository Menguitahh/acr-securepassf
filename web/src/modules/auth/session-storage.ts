import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from "@/modules/auth/data";
import { isSessionUser } from "@/modules/auth/lib";
import type { SessionUser, StoredTokens } from "@/modules/auth/types";

// localStorage/sessionStorage pueden tirar (storage deshabilitado, modo
// privado estricto). Las lecturas lo tratan como "no hay sesion"; las
// escrituras propagan el error para que el login lo muestre.
function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function saveSession(tokens: StoredTokens, user: SessionUser): void {
  saveTokens(tokens);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadAccessToken(): string | null {
  return read(() => localStorage, ACCESS_TOKEN_KEY);
}

export function loadRefreshToken(): string | null {
  return read(() => sessionStorage, REFRESH_TOKEN_KEY);
}

// Sin refresh en este tab no hay sesion, aunque el access siga en
// localStorage: un tab nuevo arranca deslogueado (web/docs/auth.md).
export function loadSession(): { tokens: StoredTokens; user: SessionUser } | null {
  const accessToken = loadAccessToken();
  const refreshToken = loadRefreshToken();
  const rawUser = read(() => localStorage, USER_KEY);
  if (!accessToken || !refreshToken || !rawUser) return null;

  let user: unknown;
  try {
    user = JSON.parse(rawUser);
  } catch {
    return null;
  }
  if (!isSessionUser(user)) return null;
  return { tokens: { accessToken, refreshToken }, user };
}

export function clearSession(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Storage inaccesible: no hay nada que borrar que se pueda leer despues.
  }
}
