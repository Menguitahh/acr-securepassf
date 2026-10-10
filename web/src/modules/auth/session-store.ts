import { create } from "zustand";

import type { Session, SessionUser, SignOutReason, Viewing } from "@/modules/auth/types";

type SessionStore = {
  session: Session;
  // #229: barrio que ve el duenio de la plataforma; null para un admin.
  viewing: Viewing | null;
  signIn: (user: SessionUser, viewing?: Viewing | null) => void;
  signOut: (reason: SignOutReason) => void;
  setViewing: (viewing: Viewing | null) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  session: { status: "restoring" },
  viewing: null,
  signIn: (user, viewing = null) => set({ session: { status: "signedIn", user }, viewing }),
  signOut: (reason) => set({ session: { status: "signedOut", reason }, viewing: null }),
  setViewing: (viewing) => set({ viewing }),
}));
