import { create } from "zustand";

import type { Session, SessionUser, SignOutReason } from "@/modules/auth/types";

type SessionStore = {
  session: Session;
  signIn: (user: SessionUser) => void;
  signOut: (reason: SignOutReason) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  session: { status: "restoring" },
  signIn: (user) => set({ session: { status: "signedIn", user } }),
  signOut: (reason) => set({ session: { status: "signedOut", reason } }),
}));
