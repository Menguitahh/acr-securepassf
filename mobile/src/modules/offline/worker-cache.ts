import { api } from '@/common/api/client';
import { getDb } from '@/common/db/database';
import { extractEnrollmentSubject, parseWeekdays, reconcileGuestEnrollments, toWorkerCacheSnapshot } from '@/modules/offline/lib';
import { peekPendingEvents } from '@/modules/offline/outbox';
import type { WorkerPermission } from '@/modules/scanner/types';

// Padron de trabajadores para validar sin red (WBS-118, D-13). Cada sync
// exitoso reemplaza las dos tablas completas en una transaccion: una baja
// de permiso no viaja como delta, desaparece de la lista. Por eso se pide
// siempre sin `since`: con el delta, el reemplazo borraria a todos los que
// no cambiaron. Sin red o con respuesta rota, el cache anterior queda.
export async function syncWorkerCache(): Promise<void> {
  try {
    const { data, error } = await api.GET('/api/v1/access/permissions/sync');
    const snapshot = !error && data ? toWorkerCacheSnapshot(data) : null;
    if (!snapshot) return;

    const db = getDb();
    db.withTransactionSync(() => {
      db.runSync('DELETE FROM worker_permissions_cache');
      db.runSync('DELETE FROM worker_enrollments_cache');
      for (const p of snapshot.permissions) {
        db.runSync(
          `INSERT OR REPLACE INTO worker_permissions_cache
             (user_id, jti, lot_id, lot_code, weekdays, daily_from, daily_until, timezone)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.userId,
            p.jti,
            p.lotId,
            p.lotCode,
            JSON.stringify(p.weekdays),
            p.dailyFrom,
            p.dailyUntil,
            p.timezone,
          ],
        );
      }
      for (const userId of snapshot.enrolledUserIds) {
        db.runSync('INSERT OR IGNORE INTO worker_enrollments_cache (user_id) VALUES (?)', [userId]);
      }
      if (snapshot.enrolledInvitationIds) {
        const pending = peekPendingEvents(Number.MAX_SAFE_INTEGER).flatMap((event) => {
          if (event.documentNumber === null) return [];
          const subject = extractEnrollmentSubject(event.token);
          return subject?.kind === 'guest' ? [subject.invitationId] : [];
        });
        const local = db
          .getAllSync<{ invitation_id: string }>('SELECT invitation_id FROM enrollments_cache')
          .map((row) => row.invitation_id);
        const { add, remove } = reconcileGuestEnrollments(snapshot.enrolledInvitationIds, pending, local);
        const now = new Date().toISOString();
        for (const id of remove) db.runSync('DELETE FROM enrollments_cache WHERE invitation_id = ?', [id]);
        // El server no manda el DNI y nadie lo lee: la fila marca el enrolamiento.
        for (const id of add) {
          db.runSync(
            "INSERT OR IGNORE INTO enrollments_cache (invitation_id, document, enrolled_at) VALUES (?, '', ?)",
            [id, now],
          );
        }
      }
    });
  } catch {
    // Sin red: el cache anterior sigue valiendo.
  }
}

export function workerPermissionsFor(userId: string): WorkerPermission[] {
  const rows = getDb().getAllSync<{
    jti: string;
    lot_id: string;
    lot_code: string;
    weekdays: string;
    daily_from: string;
    daily_until: string;
    timezone: string | null;
  }>(
    `SELECT jti, lot_id, lot_code, weekdays, daily_from, daily_until, timezone
       FROM worker_permissions_cache WHERE user_id = ? ORDER BY lot_code`,
    [userId],
  );
  return rows.map((row) => ({
    jti: row.jti,
    lotId: row.lot_id,
    lotCode: row.lot_code,
    weekdays: parseWeekdays(row.weekdays),
    dailyFrom: row.daily_from,
    dailyUntil: row.daily_until,
    timezone: row.timezone,
  }));
}

export function isWorkerEnrolled(userId: string): boolean {
  const row = getDb().getFirstSync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM worker_enrollments_cache WHERE user_id = ?',
    [userId],
  );
  return (row?.count ?? 0) > 0;
}

// Enrolamiento confirmado por el server, o hecho sin red a la espera del
// sync. El proximo sync del padron lo confirma o lo borra.
export function recordWorkerEnrollment(userId: string): void {
  getDb().runSync('INSERT OR IGNORE INTO worker_enrollments_cache (user_id) VALUES (?)', [userId]);
}

export function forgetWorkerEnrollment(userId: string): void {
  getDb().runSync('DELETE FROM worker_enrollments_cache WHERE user_id = ?', [userId]);
}
