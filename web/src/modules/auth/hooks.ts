"use client";

import { useCallback, useEffect, useState } from "react";

import { publicApi } from "@/common/api/public-client";
import { ACCESS_TOKEN_KEY, LOGIN_ERRORS, SIGN_OUT_MESSAGES } from "@/modules/auth/data";
import { isAdmin, loginErrorMessage, toSessionUser } from "@/modules/auth/lib";
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
      if (!isAdmin(user)) {
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
