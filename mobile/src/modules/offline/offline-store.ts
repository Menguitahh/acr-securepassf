import { create } from 'zustand';

import { countPendingEvents } from '@/modules/offline/outbox';

type OfflineStore = {
  pendingCount: number;
  isOffline: boolean;
  refreshPendingCount: () => void;
  setIsOffline: (offline: boolean) => void;
};

export const useOfflineStore = create<OfflineStore>((set) => ({
  pendingCount: 0,
  isOffline: false,
  refreshPendingCount: () => set({ pendingCount: countPendingEvents() }),
  setIsOffline: (offline) => set({ isOffline: offline }),
}));
