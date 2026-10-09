import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import { api } from '@/common/api/client';
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
import { notEnrolledEvent, resolveLotChoice, resolveScan } from '@/modules/scanner/scan-flow';
import type { ScanFlowDeps } from '@/modules/scanner/scan-flow';
import type {
  EnrollmentSubject,
  LotChoice,
  LotSelection,
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
  // Trabajador con red: lotes en franja. Con mas de uno, el guardia elige.
  lots: LotChoice[];
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

function scanDeps(): ScanFlowDeps {
  return {
    postValidate: ({ token: t, gateId, clientEventId: cid, capturedAt, lotId }) =>
      api.POST('/api/v1/access/validate', {
        body: { token: t, gateId, direction: 'IN', capturedAt, clientEventId: cid, ...(lotId ? { lotId } : {}) },
      }),
    buildOfflineContext,
    recordLocalUse,
    enqueueOutboxEvent,
    refreshPendingCount: () => useOfflineStore.getState().refreshPendingCount(),
    gateId: GATE_ID,
    hasValidGate,
    parseToken,
  };
}

function validateScannedToken(token: string, clientEventId: string): Promise<ScanResult> {
  return resolveScan(token, clientEventId, scanDeps());
}

export function useQrScanner() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentContext | null>(null);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [lotSelection, setLotSelection] = useState<LotSelection | null>(null);
  const pendingRef = useRef(false);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const onScan = useCallback(async (token: string) => {
    if (pendingRef.current) return;
    // La ventana de duplicado corre desde la ultima vez que se vio el QR, no
    // desde el primer escaneo: mientras el invitado siga mostrando el pase
    // que acaba de entrar, no se relee (verde y enseguida rojo).
    const now = Date.now();
    const duplicate = isDuplicateScan(lastScanRef.current, token, now);
    lastScanRef.current = { token, at: now };
    if (duplicate) return;

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
          lots: outcome.lots,
          offlineScan: outcome.offlineScan,
        });
        setEnrollmentError(null);
      } else if (outcome.status === 'needs_lot_selection') {
        setLotSelection(outcome);
      } else {
        setResult(outcome);
      }
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }, []);

  const submitEnrollment = useCallback(
    async (documentNumber: string, lotId: string | null) => {
      if (!enrollment) return;
      const gateId = GATE_ID;
      if (!gateId) {
        setEnrollmentError('Falta la garita configurada en este dispositivo.');
        return;
      }
      setIsEnrolling(true);
      setEnrollmentError(null);
      try {
        const { data, error } = await api.POST('/api/v1/access/enroll', {
          body: {
            token: enrollment.token,
            documentNumber,
            gateId,
            clientEventId: Crypto.randomUUID(),
            capturedAt: new Date().toISOString(),
            // securepassb#223: obligatorio con mas de un lote en franja.
            ...(lotId ? { lotId } : {}),
          },
        });
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
            lotCode:
              enrollment.lotCode ??
              enrollment.lots.find((lot) => lot.lotId === lotId)?.code ??
              (enrollment.lots.length === 1 ? (enrollment.lots[0]?.code ?? null) : null),
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

  // WBS-119: un toque en el lote registra el ingreso.
  const chooseLot = useCallback(
    async (lot: LotChoice) => {
      if (!lotSelection || pendingRef.current) return;
      pendingRef.current = true;
      setIsPending(true);
      try {
        const outcome = await resolveLotChoice(
          lotSelection.token,
          lot,
          lotSelection.offlineScan,
          Crypto.randomUUID(),
          scanDeps(),
        );
        setLotSelection(null);
        setResult(outcome);
      } finally {
        pendingRef.current = false;
        setIsPending(false);
      }
    },
    [lotSelection],
  );

  // Sin lote no entra. Nada que registrar: con red el server no guardo el
  // pedido, y sin red el evento todavia no se encolo.
  const cancelLotSelection = useCallback(() => setLotSelection(null), []);

  const dismiss = useCallback(() => {
    // Con el resultado en pantalla la camara no mira: la ventana arranca de
    // nuevo al volver, si no el resultado se come 2.5 s de los 3.
    const last = lastScanRef.current;
    if (last) lastScanRef.current = { token: last.token, at: Date.now() };
    setResult(null);
  }, []);

  return {
    result,
    isPending,
    enrollment,
    enrollmentError,
    isEnrolling,
    onScan,
    submitEnrollment,
    cancelEnrollment,
    lotSelection,
    chooseLot,
    cancelLotSelection,
    dismiss,
  };
}
