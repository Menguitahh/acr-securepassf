import * as Network from 'expo-network';
import { useEffect, useRef } from 'react';

import { syncAccessCache } from '@/modules/offline/access-cache';
import { PRUNE_NULL_GATE_MAX_AGE_MS, SYNC_INTERVAL_MS } from '@/modules/offline/data';
import { useOfflineStore } from '@/modules/offline/offline-store';
import { pruneOrphanOutboxEvents } from '@/modules/offline/outbox';
import { retryDelayMs, syncOutbox } from '@/modules/offline/sync';

function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

// Log accionable del prune (#83). Si removedEmpty > 0, este dispositivo
// tuvo misconfig historica de EXPO_PUBLIC_GATE_ID — quien lea el log
// tiene que ir al setup del device, no solo enterarse de un count.
// Si ambos son 0, ni loguea (evita ruido en cada mount).
function logPruneResult(result: { removedEmpty: number; removedStale: number }): void {
  const parts: string[] = [];
  if (result.removedEmpty > 0) {
    parts.push(
      `${result.removedEmpty} con gateId='' (misconfig historica de EXPO_PUBLIC_GATE_ID en este dispositivo; revisar setup)`,
    );
  }
  if (result.removedStale > 0) {
    parts.push(
      `${result.removedStale} con gateId=null anteriores al umbral de ${PRUNE_NULL_GATE_MAX_AGE_MS / (24 * 60 * 60 * 1000)} dias`,
    );
  }
  if (parts.length > 0) console.warn(`[outbox] prune al arrancar: ${parts.join(', ')}`);
}

export function useOutboxSync() {
  const refreshPendingCount = useOfflineStore((state) => state.refreshPendingCount);
  const syncingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Prune al arrancar el owner de la cola: barre huerfanos historicos
    // (gateId='' pre-#82) y filas sin garita mas viejas que el umbral. Ver
    // #83 y modules/offline/data.ts. Corre una vez por mount, antes del
    // primer refreshPendingCount para que el contador refleje la cola real.
    const pruned = pruneOrphanOutboxEvents({
      nowMs: Date.now(),
      maxAgeMsForNullGate: PRUNE_NULL_GATE_MAX_AGE_MS,
    });
    logPruneResult(pruned);

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
      useOfflineStore.getState().setIsOffline(!isOnline(state));
      if (isOnline(state)) {
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

// Baja claves publicas y revocados para la validacion offline (spec 8.2).
// Se refresca al montar y cada vez que vuelve la red.
export function useAccessCacheSync() {
  useEffect(() => {
    void syncAccessCache();
    const subscription = Network.addNetworkStateListener((state) => {
      if (isOnline(state)) void syncAccessCache();
    });
    return () => subscription.remove();
  }, []);
}
