import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import { api, authRequest } from '@/common/api/client';
import { getDb } from '@/common/db/database';
import { useSessionStore } from '@/modules/auth/session-store';
import {
  enqueueOfflineEnrollment,
  isInvitationEnrolled,
  recordSubjectEnrollment,
} from '@/modules/offline/enrollments-cache';
import { hasValidGate } from '@/modules/offline/lib';
import { useOfflineStore } from '@/modules/offline/offline-store';
import { enqueueOutboxEvent } from '@/modules/offline/outbox';
import { isWorkerEnrolled, workerPermissionsFor } from '@/modules/offline/worker-cache';
import { GATE_ID } from '@/modules/scanner/data';
import { isDuplicateScan, parseToken } from '@/modules/scanner/lib';
import { notEnrolledEvent, resolveScan } from '@/modules/scanner/scan-flow';
import type {
  EnrollmentSubject,
  OfflineContext,
  OfflineScan,
  ScanResult,
} from '@/modules/scanner/types';

type EnrollmentContext = {
  subject: EnrollmentSubject;
  token: string;
  // Nombre desde la invitacion (securepassb#173). Se usa en la pantalla
  // de enrolamiento para el cruce visual contra el nombre del PDF417.
  // Null cuando el server no lo emite (offline o server viejo).
  invitationName: string | null;
  // Lote que devolvio el validate. EnrollResponse no lo trae, asi que se
  // arrastra desde aca para mostrarlo en el resultado. Null offline.
  lotCode: string | null;
  offlineScan: OfflineScan | null;
};

function buildOfflineContext(): OfflineContext {
  const db = getDb();
  const keys: Record<string, string> = {};
  for (const row of db.getAllSync<{ kid: string; public_key: string }>(
    'SELECT kid, public_key FROM signing_keys_cache',
  )) {
    keys[row.kid] = row.public_key;
  }
  const revoked = new Set(
    db.getAllSync<{ jti: string }>('SELECT jti FROM revoked_cache').map((row) => row.jti),
  );
  const localUses = (jti: string): number => {
    const row = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM consumed_tokens WHERE jti = ?',
      [jti],
    );
    return row?.count ?? 0;
  };
  return {
    now: Math.floor(Date.now() / 1000),
    keys,
    revoked,
    localUses,
    isEnrolled: isInvitationEnrolled,
    neighborhoodTimezone: useSessionStore.getState().user?.neighborhoodTimezone ?? null,
    workerPermissions: workerPermissionsFor,
    isWorkerEnrolled,
  };
}

function recordLocalUse(jti: string, context: OfflineContext): void {
  const db = getDb();
  db.runSync(
    'INSERT OR IGNORE INTO consumed_tokens (jti, use_seq, captured_at) VALUES (?, ?, ?)',
    [jti, context.localUses(jti) + 1, new Date().toISOString()],
  );
}

function validateScannedToken(token: string, clientEventId: string): Promise<ScanResult> {
  return resolveScan(token, clientEventId, {
    postValidate: ({ token: t, gateId, clientEventId: cid, capturedAt }) =>
      authRequest(() =>
        api.POST('/api/v1/access/validate', {
          body: { token: t, gateId, direction: 'IN', capturedAt, clientEventId: cid },
        }),
      ),
    buildOfflineContext,
    recordLocalUse,
    enqueueOutboxEvent,
    refreshPendingCount: () => useOfflineStore.getState().refreshPendingCount(),
    gateId: GATE_ID,
    hasValidGate,
    parseToken,
  });
}

export function useQrScanner() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentContext | null>(null);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const pendingRef = useRef(false);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const onScan = useCallback(async (token: string) => {
    if (pendingRef.current) return;
    if (isDuplicateScan(lastScanRef.current, token, Date.now())) return;
    lastScanRef.current = { token, at: Date.now() };

    pendingRef.current = true;
    setIsPending(true);
    try {
      const outcome = await validateScannedToken(token, Crypto.randomUUID());
      if (outcome.status === 'needs_enrollment') {
        setEnrollment({
          subject: outcome.subject,
          token: outcome.token,
          invitationName: outcome.guestName,
          lotCode: outcome.lotCode,
          offlineScan: outcome.offlineScan,
        });
        setEnrollmentError(null);
      } else {
        setResult(outcome);
      }
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }, []);

  const submitEnrollment = useCallback(
    async (documentNumber: string) => {
      if (!enrollment) return;
      const gateId = GATE_ID;
      if (!gateId) {
        setEnrollmentError('Falta la garita configurada en este dispositivo.');
        return;
      }
      setIsEnrolling(true);
      setEnrollmentError(null);
      try {
        const { data, error } = await authRequest(() =>
          api.POST('/api/v1/access/enroll', {
            body: {
              token: enrollment.token,
              documentNumber,
              gateId,
              clientEventId: Crypto.randomUUID(),
              capturedAt: new Date().toISOString(),
            },
          }),
        );
        if (error || !data) {
          setEnrollmentError(
            'No se pudo enrolar. Revisá la conexion e intentá de nuevo, o registrá el ingreso manualmente.',
          );
          return;
        }
        if (data.result === 'ALLOWED') {
          recordSubjectEnrollment(enrollment.subject, documentNumber);
          setEnrollment(null);
          setResult({
            status: 'allowed',
            guestName: data.guest?.name ?? data.worker?.name ?? null,
            lotCode: enrollment.lotCode,
          });
          return;
        }
        // Mismatch = el DNI no coincide con el que espera la invitacion.
        // Se distingue de un "denied" generico porque el guardia tiene que
        // decidir si el invitado dio mal el numero o si realmente no es
        // quien dice ser.
        const reason = data.reason ?? '';
        if (/MISMATCH/i.test(reason)) {
          setEnrollmentError(
            enrollment.subject.kind === 'worker'
              ? 'El DNI no coincide con el del trabajador. Verificá el numero o registrá el ingreso manualmente.'
              : 'El DNI no coincide con el que espera la invitacion. Verificá el numero o registrá el ingreso manualmente.',
          );
        } else {
          setEnrollmentError(
            reason
              ? `Enrolamiento rechazado: ${reason}. Registrá el ingreso manualmente.`
              : 'Enrolamiento rechazado. Registrá el ingreso manualmente.',
          );
        }
      } catch {
        // Red caida: en vez de trabar al guardia, se enrola offline.
        // El evento (con documentNumber) va al outbox y se sincroniza
        // cuando vuelva la red; el cache local marca la invitacion como
        // enrolada para que scans siguientes del mismo QR no vuelvan a
        // pedir DNI. La confirmacion contra la invitacion la hace el
        // server al sincronizar — si el DNI no coincide, PR 2 borra el
        // cache local al procesar la respuesta MISMATCH.
        enqueueOfflineEnrollment({
          clientEventId: Crypto.randomUUID(),
          subject: enrollment.subject,
          token: enrollment.token,
          gateId: hasValidGate(gateId) ? gateId : null,
          documentNumber,
          capturedAt: new Date().toISOString(),
        });
        useOfflineStore.getState().refreshPendingCount();
        setEnrollment(null);
        setResult({
          status: 'allowed',
          guestName: null,
          lotCode: null,
          offlineEnrolled: true,
        });
      } finally {
        setIsEnrolling(false);
      }
    },
    [enrollment],
  );

  const cancelEnrollment = useCallback(() => {
    // Sin DNI no entra. Si el escaneo lo decidio la garita sin red, el
    // rechazo tiene que llegar al server como cualquier otro DENIED.
    if (enrollment?.offlineScan) {
      enqueueOutboxEvent(
        notEnrolledEvent(
          enrollment.token,
          enrollment.offlineScan,
          hasValidGate(GATE_ID) ? GATE_ID : null,
        ),
      );
      useOfflineStore.getState().refreshPendingCount();
    }
    setEnrollment(null);
    setEnrollmentError(null);
  }, [enrollment]);

  const dismiss = useCallback(() => setResult(null), []);

  return {
    result,
    isPending,
    enrollment,
    enrollmentError,
    isEnrolling,
    onScan,
    submitEnrollment,
    cancelEnrollment,
    dismiss,
  };
}
