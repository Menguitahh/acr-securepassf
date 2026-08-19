import * as Network from 'expo-network';
import { useEffect, useRef } from 'react';

import { SYNC_INTERVAL_MS } from '@/modules/offline/data';
import { useOfflineStore } from '@/modules/offline/offline-store';
import { retryDelayMs, syncOutbox } from '@/modules/offline/sync';

export function useOutboxSync() {
  const refreshPendingCount = useOfflineStore((state) => state.refreshPendingCount);
  const syncingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshPendingCount();

    const attemptSync = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const outcome = await syncOutbox();
        refreshPendingCount();
        if (outcome === 'error') scheduleRetry();
      } finally {
        syncingRef.current = false;
      }
    };

    const scheduleRetry = () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => void attemptSync(), retryDelayMs());
    };

    const interval = setInterval(() => void attemptSync(), SYNC_INTERVAL_MS);
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void attemptSync();
      }
    });

    void attemptSync();

    return () => {
      clearInterval(interval);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      subscription.remove();
    };
  }, [refreshPendingCount]);
}
