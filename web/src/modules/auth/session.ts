import { getQueryClient } from "@/common/api/query-client";
import { publicApi } from "@/common/api/public-client";
import { canUseDashboard } from "@/modules/auth/lib";
import {
  clearSession,
  loadAccessToken,
  loadRefreshToken,
  loadSession,
  loadViewing,
  saveViewing,
} from "@/modules/auth/session-storage";
import { useSessionStore } from "@/modules/auth/session-store";
import type { SignOutReason, StoredTokens, Viewing } from "@/modules/auth/types";

// Unico camino de salida de la sesion: storage, cache de queries y store.
// El guard reacciona al cambio de status y redirige a /login.
export function endSession(reason: SignOutReason): void {
  clearSession();
  getQueryClient().clear();
  useSessionStore.getState().signOut(reason);
}

// Revoca la familia de refresh en el server. Best effort: si falla, el
// refresh igual se descarta del lado del cliente.
export async function revokeRemote(tokens: StoredTokens): Promise<void> {
  try {
    await publicApi.POST("/api/v1/auth/logout", {
      body: { refreshToken: tokens.refreshToken },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
  } catch {
    // Red caida: el refresh muere igual al cerrar el tab.
  }
}

// Local primero: en una computadora compartida la sesion tiene que morir
// en el acto aunque el server tarde. La revocacion remota va detras.
export function logout(): void {
  const accessToken = loadAccessToken();
  const refreshToken = loadRefreshToken();
  endSession(null);
  if (accessToken && refreshToken) void revokeRemote({ accessToken, refreshToken });
}

export function restoreSession(): void {
  const stored = loadSession();
  if (!stored) {
    // Sin limpiar storage: el access puede ser de otro tab con sesion viva.
    useSessionStore.getState().signOut(null);
    return;
  }
  if (!canUseDashboard(stored.user)) {
    void revokeRemote(stored.tokens);
    endSession("notAdmin");
    return;
  }
  useSessionStore.getState().signIn(stored.user, stored.user.kind === "platform" ? loadViewing() : null);
}

// #229: el duenio de la plataforma entra a ver un barrio o vuelve al panel.
// El cache se vacia: las consultas del admin no llevan el barrio en la key y
// mostrarian datos del barrio anterior.
export function setViewing(viewing: Viewing | null): void {
  saveViewing(viewing);
  getQueryClient().clear();
  useSessionStore.getState().setViewing(viewing);
}
