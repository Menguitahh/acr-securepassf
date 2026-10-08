import { create } from 'zustand';

import { loadSession } from '@/modules/auth/session-storage';
import type { SessionStatus, SessionUser, SignOutReason } from '@/modules/auth/types';

type SessionStore = {
  status: SessionStatus;
  user: SessionUser | null;
  signOutReason: SignOutReason;
  restore: () => Promise<void>;
  signIn: (user: SessionUser) => void;
  signOut: (reason?: SignOutReason) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  status: 'restoring',
  user: null,
  signOutReason: null,
  restore: async () => {
    const session = await loadSession();
    if (!session) {
      set({ status: 'signedOut', user: null, signOutReason: null });
      return;
    }
    set({ status: 'signedIn', user: session.user, signOutReason: null });
  },
  signIn: (user) => set({ status: 'signedIn', user, signOutReason: null }),
  signOut: (reason = null) => set({ status: 'signedOut', user: null, signOutReason: reason }),
}));
