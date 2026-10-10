"use client";

import { useCallback, useEffect, useState } from "react";

import { publicApi } from "@/common/api/public-client";
import { ACCESS_TOKEN_KEY, LOGIN_ERRORS, SIGN_OUT_MESSAGES } from "@/modules/auth/data";
import { canUseDashboard, loginErrorMessage, toSessionUser } from "@/modules/auth/lib";
import { endSession, restoreSession, revokeRemote } from "@/modules/auth/session";
import { saveSession } from "@/modules/auth/session-storage";
import { useSessionStore } from "@/modules/auth/session-store";
import type { LoginResult } from "@/modules/auth/types";

// Montado una vez en el root: rehidrata la sesion y escucha a los otros
// tabs. Si otro tab borra el access (cerro sesion, o su refresh fue
// rechazado y revoco la familia), este tab cierra tambien en vez de
// seguir con un access que muere en <=15 min.
export function useSessionBootstrap(): void {
  useEffect(() => {
    restoreSession();

    function onStorage(event: StorageEvent) {
      const accessRemoved = event.key === null || (event.key === ACCESS_TOKEN_KEY && event.newValue === null);
      if (!accessRemoved) return;
      if (useSessionStore.getState().session.status !== "signedIn") return;
      endSession("otherTab");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

export function useLogin() {
  const [isPending, setIsPending] = useState(false);

  const login = useCallback(async (identifier: string, password: string): Promise<LoginResult> => {
    setIsPending(true);
    try {
      let result;
      try {
        result = await publicApi.POST("/api/v1/auth/login", { body: { identifier, password } });
      } catch {
        return { ok: false, message: LOGIN_ERRORS.network };
      }
      const { data, response } = result;
      if (!response.ok) {
        return { ok: false, message: loginErrorMessage(response.status, response.headers.get("Retry-After")) };
      }

      const user = data?.user ? toSessionUser(data.user) : null;
      if (!data?.accessToken || !data.refreshToken || !user) {
        return { ok: false, message: LOGIN_ERRORS.incompleteSession };
      }
      const tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken };

      // Credenciales validas pero sin ADMIN: no se persiste nada y se
      // revoca la familia en el server. No queda sesion a medias.
      if (!canUseDashboard(user)) {
        await revokeRemote(tokens);
        return { ok: false, message: SIGN_OUT_MESSAGES.notAdmin };
      }

      try {
        saveSession(tokens, user);
      } catch {
        await revokeRemote(tokens);
        return { ok: false, message: LOGIN_ERRORS.storage };
      }
      useSessionStore.getState().signIn(user);
      return { ok: true };
    } finally {
      setIsPending(false);
    }
  }, []);

  return { login, isPending };
}

// Zona horaria del barrio que se esta mirando: el propio del admin, o el que
// eligio el duenio de la plataforma. null fuera de un barrio.
export function useNeighborhoodTimeZone(): string | null {
  const session = useSessionStore((state) => state.session);
  const viewing = useSessionStore((state) => state.viewing);
  if (session.status !== "signedIn") return null;
  if (session.user.kind === "admin") return session.user.neighborhoodTimezone;
  return viewing?.timeZone ?? null;
}

// #229: el duenio de la plataforma ve los barrios sin modificarlos. El
// backend rechaza igual cualquier escritura; esto evita mostrar botones que
// darian 403.
export function useReadOnly(): boolean {
  return useSessionStore((state) => state.viewing !== null);
}
