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

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
  }, [status, router]);

  if (status !== "signedIn") return <Splash />;
  return children;
}
