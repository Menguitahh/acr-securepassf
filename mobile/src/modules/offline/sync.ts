import { backoffDelayFor, runSyncCycle } from '@/modules/offline/lib';
import { SYNC_BATCH_SIZE } from '@/modules/offline/data';
import {
  markSyncFailure,
  maxSyncAttempts,
  peekPendingEvents,
  removeEvents,
} from '@/modules/offline/outbox';

export function retryDelayMs(): number {
  return backoffDelayFor(maxSyncAttempts());
}

// ponytail: el envio real (POST /access/sync) espera el endpoint en el
// OpenAPI del backend (WBS-25). Hasta entonces todo sync falla como si
// el server no respondiera: la cola nunca se descarta y el backoff corre.
export async function syncOutbox(): Promise<'empty' | 'synced' | 'error'> {
  return runSyncCycle(
    {
      peek: peekPendingEvents,
      send: async () => {
        throw new Error('sync endpoint pendiente (backend WBS-25)');
      },
      remove: removeEvents,
      markFailure: markSyncFailure,
    },
    SYNC_BATCH_SIZE,
  );
}
