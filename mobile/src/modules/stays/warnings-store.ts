import { getDb } from '@/common/db/database';
import type { LocalWarning } from '@/modules/stays/types';

// Aviso local de cada estadia en este dispositivo: cuando dispara y si el
// server ya sabe que se aviso (#31).
export function warningStates(): Map<string, LocalWarning> {
  const db = getDb();
  const rows = db.getAllSync<{ stay_id: string; fire_at: string | null; mark_warned_synced: number }>(
    'SELECT stay_id, fire_at, mark_warned_synced FROM stay_warnings',
  );
  return new Map(
    rows.map((row) => [
      row.stay_id,
      { fireAt: row.fire_at ? Date.parse(row.fire_at) : null, synced: row.mark_warned_synced === 1 },
    ]),
  );
}

export function recordWarning(stayId: string, notificationId: string | null, fireAt: number): void {
  const db = getDb();
  db.runSync(
    `INSERT OR REPLACE INTO stay_warnings (stay_id, warned_at, notification_id, fire_at, mark_warned_synced)
     VALUES (?, ?, ?, ?, 0)`,
    [stayId, new Date().toISOString(), notificationId, new Date(fireAt).toISOString()],
  );
}

export function markSyncedToServer(stayId: string): void {
  const db = getDb();
  db.runSync('UPDATE stay_warnings SET mark_warned_synced = 1 WHERE stay_id = ?', [stayId]);
}

export function forgetWarning(stayId: string): string | null {
  const db = getDb();
  const row = db.getFirstSync<{ notification_id: string | null }>(
    'SELECT notification_id FROM stay_warnings WHERE stay_id = ?',
    [stayId],
  );
  db.runSync('DELETE FROM stay_warnings WHERE stay_id = ?', [stayId]);
  return row?.notification_id ?? null;
}
