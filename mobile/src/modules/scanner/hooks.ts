import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import { api, authRequest } from '@/common/api/client';
import { getDb } from '@/common/db/database';
import { isInvitationEnrolled, recordEnrollment } from '@/modules/offline/enrollments-cache';
import { useOfflineStore } from '@/modules/offline/offline-store';
import { enqueueOutboxEvent } from '@/modules/offline/outbox';
import { GATE_ID } from '@/modules/scanner/data';
import { isDuplicateScan, parseToken, toScanResult, validateOffline } from '@/modules/scanner/lib';
import type { OfflineContext, ScanResult } from '@/modules/scanner/types';

type EnrollmentContext = { invitationId: string; token: string };

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
  };
}

function recordLocalUse(jti: string, context: OfflineContext): void {
  const db = getDb();
  db.runSync(
    'INSERT OR IGNORE INTO consumed_tokens (jti, use_seq, captured_at) VALUES (?, ?, ?)',
    [jti, context.localUses(jti) + 1, new Date().toISOString()],
  );
}

async function validateScannedToken(token: string, clientEventId: string): Promise<ScanResult> {
  const capturedAt = new Date().toISOString();

  if (GATE_ID) {
    const gateId = GATE_ID;
    try {
      const { data, error } = await authRequest(() =>
        api.POST('/api/v1/access/validate', {
          body: {
            token,
            gateId,
            direction: 'IN',
            capturedAt,
            clientEventId,
          },
        }),
      );
      const scanResult = data ? toScanResult(data) : null;
      if (scanResult) return scanResult;
      if (error) {
        // El server respondio (no es caida de red): su veredicto manda.
        return {
          status: 'denied',
          reason: 'UNKNOWN',
          message: 'El server rechazó el pase. Intentá de nuevo o registrá el ingreso manualmente.',
        };
      }
    } catch {
      // Sin red: validacion offline.
    }
  }

  const context = buildOfflineContext();
  const decision = validateOffline(token, context);

  if (decision.status === 'needs_enrollment') {
    // El scanner encara el flujo de DNI + POST /access/enroll; no se
    // registra ingreso todavia. Se pospone el enqueue del outbox hasta
    // que la decision real (allowed o denied) exista.
    return { status: 'needs_enrollment', invitationId: decision.invitationId, token };
  }

  if (decision.status === 'allowed') {
    const parsed = parseToken(token);
    if (parsed) recordLocalUse(parsed.payload.j, context);
  }

  enqueueOutboxEvent({
    clientEventId,
    token,
    gateId: GATE_ID ?? null,
    direction: 'IN',
    companions: null,
    capturedAt,
    localDecision: decision.status === 'allowed' ? 'ALLOWED' : 'DENIED',
  });
  useOfflineStore.getState().refreshPendingCount();

  if (decision.status === 'allowed') {
    // Offline no conoce nombre ni lote: el QR no lleva PII (spec 5.1).
    return { status: 'allowed', guestName: null, lotCode: null };
  }
  return decision;
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
        setEnrollment({ invitationId: outcome.invitationId, token: outcome.token });
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
          recordEnrollment(enrollment.invitationId, documentNumber);
          setEnrollment(null);
          setResult({
            status: 'allowed',
            guestName: data.guest?.name ?? null,
            lotCode: null,
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
            'El DNI no coincide con el que espera la invitacion. Verificá el numero o registrá el ingreso manualmente.',
          );
        } else {
          setEnrollmentError(
            reason
              ? `Enrolamiento rechazado: ${reason}. Registrá el ingreso manualmente.`
              : 'Enrolamiento rechazado. Registrá el ingreso manualmente.',
          );
        }
      } catch {
        setEnrollmentError(
          'Sin conexion. Intentá de nuevo cuando vuelva la red o registrá el ingreso manualmente.',
        );
      } finally {
        setIsEnrolling(false);
      }
    },
    [enrollment],
  );

  const cancelEnrollment = useCallback(() => {
    setEnrollment(null);
    setEnrollmentError(null);
  }, []);

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
