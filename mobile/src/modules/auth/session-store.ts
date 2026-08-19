import { create } from 'zustand';

import { loadSession } from '@/modules/auth/session-storage';
import type { SessionStatus, SessionUser } from '@/modules/auth/types';

type SessionStore = {
  status: SessionStatus;
  user: SessionUser | null;
  restore: () => Promise<void>;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  status: 'restoring',
  user: null,
  restore: async () => {
    const session = await loadSession();
    if (!session) {
      set({ status: 'signedOut', user: null });
      return;
    }
    set({ status: 'signedIn', user: session.user });
  },
  signIn: (user) => set({ status: 'signedIn', user }),
  signOut: () => set({ status: 'signedOut', user: null }),
}));
