import { getDb } from '@/common/db/database';

// Marca local de que un stay ya recibio su aviso. Se usa como fuente
// de verdad mientras no haya red para escribir warned_at server-side.
export function hasBeenWarned(stayId: string): boolean {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM stay_warnings WHERE stay_id = ?',
    [stayId],
  );
  return (row?.count ?? 0) > 0;
}

export function warnedStayIds(): Set<string> {
  const db = getDb();
  const rows = db.getAllSync<{ stay_id: string }>('SELECT stay_id FROM stay_warnings');
  return new Set(rows.map((row) => row.stay_id));
}

export function recordWarning(stayId: string, notificationId: string | null): void {
  const db = getDb();
  db.runSync(
    'INSERT OR REPLACE INTO stay_warnings (stay_id, warned_at, notification_id) VALUES (?, ?, ?)',
    [stayId, new Date().toISOString(), notificationId],
  );
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
