import { create } from 'zustand';

import { countPendingEvents } from '@/modules/offline/outbox';

type OfflineStore = {
  pendingCount: number;
  refreshPendingCount: () => void;
};

export const useOfflineStore = create<OfflineStore>((set) => ({
  pendingCount: 0,
  refreshPendingCount: () => set({ pendingCount: countPendingEvents() }),
}));
