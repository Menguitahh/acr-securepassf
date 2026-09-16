import { getDb } from '@/common/db/database';
import { classifyOrphanOutboxRows, isOutboxEvent } from '@/modules/offline/lib';
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

export function markSyncFailure(clientEventIds: string[], reason: string): void {
  if (clientEventIds.length === 0) return;
  const db = getDb();
  const placeholders = clientEventIds.map(() => '?').join(', ');
  db.runSync(
    `UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE client_event_id IN (${placeholders})`,
    [reason, ...clientEventIds],
  );
}

// Cleanup de huerfanos al arrancar (#83). Lee todas las filas, delega la
// decision a classifyOrphanOutboxRows (funcion pura, ver lib.ts), y borra
// solo los client_event_id que esa clasificacion marca. La regla dura —
// una fila con gateId real no se toca — vive en el test de la funcion
// pura, no en el SQL.
export function pruneOrphanOutboxEvents(input: {
  nowMs: number;
  maxAgeMsForNullGate: number;
}): { removedEmpty: number; removedStale: number } {
  const db = getDb();
  const rows = db.getAllSync<{
    client_event_id: string;
    payload: string;
    created_at: string;
  }>('SELECT client_event_id, payload, created_at FROM outbox');

  const { removeEmpty, removeStale } = classifyOrphanOutboxRows(
    rows.map((row) => ({
      clientEventId: row.client_event_id,
      payload: row.payload,
      createdAt: row.created_at,
    })),
    input.nowMs,
    input.maxAgeMsForNullGate,
  );

  const ids = [...removeEmpty, ...removeStale];
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(', ');
    db.runSync(`DELETE FROM outbox WHERE client_event_id IN (${placeholders})`, ids);
  }

  return { removedEmpty: removeEmpty.length, removedStale: removeStale.length };
}

export function maxSyncAttempts(): number {
  const db = getDb();
  const row = db.getFirstSync<{ attempts: number | null }>(
    'SELECT MAX(attempts) AS attempts FROM outbox',
  );
  return row?.attempts ?? 0;
}
