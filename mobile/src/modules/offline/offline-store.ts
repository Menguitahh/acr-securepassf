import { create } from 'zustand';

import { pendingManual } from '@/modules/offline/manual-queue';

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
  // WBS-36: la cola incluye los ingresos manuales registrados sin red.
  refreshPendingCount: () => set({ pendingCount: countPendingEvents() + pendingManual().length }),
  setIsOffline: (offline) => set({ isOffline: offline }),
}));
