import { BACKOFF_SCHEDULE_MS } from '@/modules/offline/data';
import type { OutboxEvent } from '@/modules/offline/types';

export function backoffDelayFor(attempts: number): number {
  const index = Math.min(Math.max(attempts, 0), BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[index] ?? BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1] ?? 300000;
}

export function isOutboxEvent(value: unknown): value is OutboxEvent {
  if (typeof value !== 'object' || value === null) return false;
  if (!('clientEventId' in value) || typeof value.clientEventId !== 'string') return false;
  if (!('token' in value) || typeof value.token !== 'string') return false;
  if (!('gateId' in value) || (typeof value.gateId !== 'string' && value.gateId !== null)) {
    return false;
  }
  if (!('direction' in value) || (value.direction !== 'IN' && value.direction !== 'OUT')) {
    return false;
  }
  if (!('companions' in value) || (typeof value.companions !== 'number' && value.companions !== null)) {
    return false;
  }
  if (!('capturedAt' in value) || typeof value.capturedAt !== 'string') return false;
  if (
    !('localDecision' in value) ||
    (value.localDecision !== 'ALLOWED' && value.localDecision !== 'DENIED')
  ) {
    return false;
  }
  return true;
}

export type SyncCycleDeps = {
  peek: (limit: number) => OutboxEvent[];
  send: (events: OutboxEvent[]) => Promise<void>;
  remove: (clientEventIds: string[]) => void;
  markFailure: () => void;
};

export type SyncCycleOutcome = 'empty' | 'synced' | 'error';

// Un ciclo de sync: toma un batch, lo envia y solo lo borra de la cola
// si el server respondio. La red caida nunca descarta eventos (spec 8.4).
export async function runSyncCycle(
  deps: SyncCycleDeps,
  limit: number,
): Promise<SyncCycleOutcome> {
  const events = deps.peek(limit);
  if (events.length === 0) return 'empty';
  try {
    await deps.send(events);
  } catch {
    deps.markFailure();
    return 'error';
  }
  deps.remove(events.map((event) => event.clientEventId));
  return 'synced';
}
