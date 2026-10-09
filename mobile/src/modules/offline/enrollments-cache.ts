import { getDb } from '@/common/db/database';
import { enqueueOutboxEvent } from '@/modules/offline/outbox';
import { recordWorkerEnrollment } from '@/modules/offline/worker-cache';
import type { EnrollmentSubject } from '@/modules/scanner/types';

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

// El server rechazo el enrolamiento offline por DOCUMENT_MISMATCH: el
// DNI capturado offline no coincide con el que espera la invitacion.
// La fila local es mentirosa (permitio scans subsiguientes sin pedir
// DNI); se borra para que el proximo scan del mismo QR vuelva al
// flujo de needs_enrollment. Ver sync.ts::classifyResults.
export function forgetEnrollment(invitationId: string): void {
  const db = getDb();
  db.runSync('DELETE FROM enrollments_cache WHERE invitation_id = ?', [invitationId]);
}

// El invitado se marca por invitacion y el trabajador por usuario
// (WBS-118): cada uno tiene su cache.
export function recordSubjectEnrollment(subject: EnrollmentSubject, document: string): void {
  if (subject.kind === 'worker') recordWorkerEnrollment(subject.userId);
  else recordEnrollment(subject.invitationId, document);
}

// Enrolamiento offline (#27): el server no pudo confirmar en el momento
// del scan, se persiste local Y se encola para sync. Combinar las dos
// mitades en un solo helper evita el ordering error de olvidarse una:
// sin recordEnrollment el proximo scan del mismo QR volveria a pedir DNI
// aunque el guardia ya lo capturo; sin enqueueOutboxEvent el ingreso
// nunca queda registrado en el server aunque el invitado entro.
//
// Un solo evento en el outbox transporta enrolamiento + ingreso: el
// mapping en toSyncEvent (proximo commit, cuando este el contrato con
// documentNumber) los combina en un Event con el campo poblado.
export function enqueueOfflineEnrollment(input: {
  clientEventId: string;
  subject: EnrollmentSubject;
  token: string;
  gateId: string | null;
  documentNumber: string;
  capturedAt: string;
}): void {
  recordSubjectEnrollment(input.subject, input.documentNumber);
  enqueueOutboxEvent({
    clientEventId: input.clientEventId,
    token: input.token,
    gateId: input.gateId,
    direction: 'IN',
    companions: null,
    capturedAt: input.capturedAt,
    localDecision: 'ALLOWED',
    documentNumber: input.documentNumber,
  });
}
