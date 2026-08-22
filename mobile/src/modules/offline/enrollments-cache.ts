import { getDb } from '@/common/db/database';

// Cache local de invitaciones ya enroladas (US-36). Una fila por invitacion:
// la primera vez que el guardia captura el DNI, el backend responde y el
// scanner registra la asociacion aca. En scans posteriores del mismo QR,
// validateOffline ve `isEnrolled === true` y permite el ingreso sin pedir
// DNI otra vez. First-captured-wins se resuelve en el server; el cache
// local solo espeja la decision confirmada.
export function isInvitationEnrolled(invitationId: string): boolean {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM enrollments_cache WHERE invitation_id = ?',
    [invitationId],
  );
  return (row?.count ?? 0) > 0;
}

export function recordEnrollment(invitationId: string, document: string): void {
  const db = getDb();
  db.runSync(
    'INSERT OR REPLACE INTO enrollments_cache (invitation_id, document, enrolled_at) VALUES (?, ?, ?)',
    [invitationId, document, new Date().toISOString()],
  );
}
