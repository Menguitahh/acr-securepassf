import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import { api, authRequest } from '@/common/api/client';
import { getDb } from '@/common/db/database';
import { isInvitationEnrolled } from '@/modules/offline/enrollments-cache';
import { useOfflineStore } from '@/modules/offline/offline-store';
import { enqueueOutboxEvent } from '@/modules/offline/outbox';
import { GATE_ID } from '@/modules/scanner/data';
import { isDuplicateScan, parseToken, toScanResult, validateOffline } from '@/modules/scanner/lib';
import type { OfflineContext, ScanResult } from '@/modules/scanner/types';

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
      setResult(outcome);
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }, []);

  const dismiss = useCallback(() => setResult(null), []);

  return { result, isPending, onScan, dismiss };
}
