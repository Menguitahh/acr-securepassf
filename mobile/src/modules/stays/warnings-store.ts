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

// Estado local de cada stay avisado por este device (#31 mark-warned).
// mark_warned_synced=true indica que este device llamo a POST
// /stays/{id}/mark-warned con exito, o sea que es el dueño registrado
// del aviso en el server. Si el server despues devuelve warned=true,
// no hay que cancelar la notif local — fue mi POST el que lo marco.
export type StayWarningState = {
  syncedToServer: boolean;
};

export function warnedStayStates(): Map<string, StayWarningState> {
  const db = getDb();
  const rows = db.getAllSync<{ stay_id: string; mark_warned_synced: number }>(
    'SELECT stay_id, mark_warned_synced FROM stay_warnings',
  );
  return new Map(
    rows.map((row) => [row.stay_id, { syncedToServer: row.mark_warned_synced === 1 }]),
  );
}

export function recordWarning(stayId: string, notificationId: string | null): void {
  const db = getDb();
  db.runSync(
    'INSERT OR REPLACE INTO stay_warnings (stay_id, warned_at, notification_id, mark_warned_synced) VALUES (?, ?, ?, 0)',
    [stayId, new Date().toISOString(), notificationId],
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
