import { getDb } from '@/common/db/database';
import { isOutboxEvent } from '@/modules/offline/lib';
import type { OutboxEvent } from '@/modules/offline/types';

export function enqueueOutboxEvent(event: OutboxEvent): void {
  const db = getDb();
  db.runSync(
    'INSERT INTO outbox (client_event_id, payload, created_at) VALUES (?, ?, ?)',
    [event.clientEventId, JSON.stringify(event), new Date().toISOString()],
  );
}

export function countPendingEvents(): number {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) AS count FROM outbox');
  return row?.count ?? 0;
}

export function peekPendingEvents(limit: number): OutboxEvent[] {
  const db = getDb();
  const rows = db.getAllSync<{ payload: string }>(
    'SELECT payload FROM outbox ORDER BY created_at ASC LIMIT ?',
    [limit],
  );
  const events: OutboxEvent[] = [];
  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.payload);
    } catch {
      continue;
    }
    if (isOutboxEvent(parsed)) events.push(parsed);
  }
  return events;
}

export function removeEvents(clientEventIds: string[]): void {
  if (clientEventIds.length === 0) return;
  const db = getDb();
  const placeholders = clientEventIds.map(() => '?').join(', ');
  db.runSync(`DELETE FROM outbox WHERE client_event_id IN (${placeholders})`, clientEventIds);
}

export function markSyncFailure(): void {
  const db = getDb();
  db.runSync('UPDATE outbox SET attempts = attempts + 1, last_error = ?', [
    'red caida al intentar sync',
  ]);
}

export function maxSyncAttempts(): number {
  const db = getDb();
  const row = db.getFirstSync<{ attempts: number | null }>(
    'SELECT MAX(attempts) AS attempts FROM outbox',
  );
  return row?.attempts ?? 0;
}
