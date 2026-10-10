"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Splash } from "@/modules/auth/components/splash";
import { useSessionStore } from "@/modules/auth/session-store";

interface Props {
  children: React.ReactNode;
}

// UX, no seguridad: el control real es @PreAuthorize en /admin/** del
// backend. Esto evita mostrar el dashboard a quien no tiene sesion.
export function AdminGuard({ children }: Props) {
  const router = useRouter();
  const status = useSessionStore((state) => state.session.status);
  // #229: el duenio de la plataforma sin barrio elegido va a su panel.
  const toPlatform = useSessionStore(
    (state) => state.session.status === "signedIn" && state.session.user.kind === "platform" && !state.viewing,
  );

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
    else if (toPlatform) router.replace("/plataforma");
  }, [status, toPlatform, router]);

  if (status !== "signedIn" || toPlatform) return <Splash />;
  return children;
}
