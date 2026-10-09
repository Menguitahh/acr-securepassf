"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Splash } from "@/modules/auth/components/splash";
import { SIGN_OUT_MESSAGES } from "@/modules/auth/data";
import { useLogin } from "@/modules/auth/hooks";
import { useSessionStore } from "@/modules/auth/session-store";

export function LoginView() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const { login, isPending } = useLogin();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status === "signedIn") router.replace("/");
  }, [session.status, router]);

  if (session.status !== "signedOut") return <Splash />;

  const notice = session.reason ? SIGN_OUT_MESSAGES[session.reason] : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const identifier = new FormData(event.currentTarget).get("identifier");
    if (typeof identifier !== "string") return;
    const result = await login(identifier.trim(), password);
    if (!result.ok) {
      setError(result.message);
      setPassword("");
    }
  }

  const message = error ?? notice;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-bg-surface p-6">
        <h1 className="text-2xl font-semibold">Ingresar</h1>

        {message && (
          <p role="alert" className="rounded-md border border-border bg-bg-elevated p-3 text-sm">
            {message}
          </p>
        )}

        <label className="flex flex-col gap-2 text-sm">
          Email
          <input
            name="identifier"
            type="email"
            autoComplete="username"
            required
            className="min-h-12 rounded-xl border border-border bg-bg-elevated px-4 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-text-primary"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-12 rounded-xl border border-border bg-bg-elevated px-4 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-text-primary"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 rounded-md bg-text-primary font-medium text-bg-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary disabled:opacity-60"
        >
          {isPending ? "Ingresando" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
