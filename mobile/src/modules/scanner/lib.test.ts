import { getPublicKey, sign, utils } from '@noble/ed25519';
import { describe, expect, it } from 'vitest';

import { TOKEN_PREFIX } from '@/modules/scanner/data';
import {
  isDenialReason,
  isDuplicateScan,
  isWithinRecurringSchedule,
  formatDni,
  parseArgentineDni,
  parseToken,
  toScanResult,
  validateOffline,
} from '@/modules/scanner/lib';
import type { InvitationPayload, OfflineContext, TokenPayload, WorkerPermission } from '@/modules/scanner/types';

const NOW = 1755540000;

function corruptCharAt(value: string, index: number): string {
  const current = value.charAt(index);
  const replacement = current === 'A' ? 'B' : 'A';
  return value.slice(0, index) + replacement + value.slice(index + 1);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function makeToken(payload: TokenPayload, secretKey: Uint8Array): string {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = sign(payloadBytes, secretKey);
  return `${TOKEN_PREFIX}${toBase64Url(payloadBytes)}.${toBase64Url(signature)}`;
}

function basePayload(overrides: Partial<InvitationPayload> = {}): InvitationPayload {
  return {
    v: 1,
    k: 'a1b2c3d4',
    j: '8f3c9a2e-1111-4222-8333-444455556666',
    n: 'b1a2c3d4-2222-4333-9444-555566667777',
    l: 'c9d8e7f6-3333-4444-a555-666677778888',
    i: '7e6f5d4c-4444-4555-b666-777788889999',
    t: 'S',
    f: NOW - 3600,
    u: NOW + 3600,
    m: 1,
    ...overrides,
  };
}

function makeContext(overrides: Partial<OfflineContext> = {}): OfflineContext {
  return {
    now: NOW,
    keys: {},
    revoked: new Set(),
    localUses: () => 0,
    // Default enrolado: los tests preexistentes verifican otras condiciones
    // sin preocuparse por el enrolamiento. Los tests de needs_enrollment
    // sobreescriben esta funcion.
    isEnrolled: () => true,
    neighborhoodTimezone: 'America/Argentina/Mendoza',
    workerPermissions: () => [],
    isWorkerEnrolled: () => true,
    ...overrides,
  };
}

describe('validateOffline - motivos de denegacion', () => {
  const secretKey = utils.randomSecretKey();
  const publicKey = toBase64Url(getPublicKey(secretKey));
  const context = makeContext({ keys: { a1b2c3d4: publicKey } });

  it('deniega con INVALID_SIGNATURE un token malformado', () => {
    expect(validateOffline('garbage', context)).toEqual({
      status: 'denied',
      reason: 'INVALID_SIGNATURE',
      message: expect.any(String),
    });
    expect(validateOffline('SP1.abc', context)).toMatchObject({ reason: 'INVALID_SIGNATURE' });
    expect(validateOffline('SP1.!!!!.!!!!', context)).toMatchObject({
      reason: 'INVALID_SIGNATURE',
    });
  });

  it('deniega con INVALID_SIGNATURE un kid sin clave conocida', () => {
    const token = makeToken(basePayload({ k: 'ffffffff' }), secretKey);
    expect(validateOffline(token, context)).toMatchObject({ reason: 'INVALID_SIGNATURE' });
  });

  it('deniega con INVALID_SIGNATURE un payload adulterado o firmado por otra clave', () => {
    const otherKey = utils.randomSecretKey();
    const token = makeToken(basePayload({ m: 10 }), secretKey);
    const [payloadPart, signaturePart] = token.slice(TOKEN_PREFIX.length).split('.');
    const tamperedPayload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadPart ?? '')),
    );
    tamperedPayload.m = 1;
    const tampered = `${TOKEN_PREFIX}${toBase64Url(
      new TextEncoder().encode(JSON.stringify(tamperedPayload)),
    )}.${signaturePart}`;
    expect(validateOffline(tampered, context)).toMatchObject({ reason: 'INVALID_SIGNATURE' });

    const otherContext = makeContext({ keys: { a1b2c3d4: toBase64Url(getPublicKey(otherKey)) } });
    const wrongKeyToken = makeToken(basePayload(), secretKey);
    expect(validateOffline(wrongKeyToken, otherContext)).toMatchObject({
      reason: 'INVALID_SIGNATURE',
    });
  });

  it('deniega con INVALID_SIGNATURE un pase RECURRING sin franja horaria', () => {
    const token = makeToken(basePayload({ t: 'R' }), secretKey);
    expect(validateOffline(token, context)).toMatchObject({ reason: 'INVALID_SIGNATURE' });
  });

  it('deniega con INVALID_SIGNATURE una version de formato desconocida', () => {
    const token = makeToken(basePayload({ v: 2 }), secretKey);
    expect(validateOffline(token, context)).toMatchObject({ reason: 'INVALID_SIGNATURE' });
  });

  it('deniega con REVOKED un jti revocado', () => {
    const token = makeToken(basePayload(), secretKey);
    const revoked = makeContext({
      keys: { a1b2c3d4: publicKey },
      revoked: new Set(['8f3c9a2e-1111-4222-8333-444455556666']),
    });
    expect(validateOffline(token, revoked)).toMatchObject({ reason: 'REVOKED' });
  });

  it('deniega con NOT_YET_VALID antes de la ventana', () => {
    const token = makeToken(basePayload({ f: NOW + 60 }), secretKey);
    expect(validateOffline(token, context)).toMatchObject({ reason: 'NOT_YET_VALID' });
  });

  it('deniega con EXPIRED despues de la ventana', () => {
    const token = makeToken(basePayload({ u: NOW - 60 }), secretKey);
    expect(validateOffline(token, context)).toMatchObject({ reason: 'EXPIRED' });
  });

  it('deniega con OUT_OF_SCHEDULE fuera del dia de la franja', () => {
    const date = new Date(NOW * 1000);
    const weekday = ((date.getDay() + 6) % 7) + 1;
    const otherDays = [1, 2, 3, 4, 5, 6, 7].filter((day) => day !== weekday);
    const token = makeToken(
      basePayload({ t: 'R', w: otherDays, df: '00:00', du: '23:59' }),
      secretKey,
    );
    expect(validateOffline(token, context)).toMatchObject({ reason: 'OUT_OF_SCHEDULE' });
  });

  it('deniega con OUT_OF_SCHEDULE fuera del horario de la franja', () => {
    const token = makeToken(
      basePayload({ t: 'R', w: [1, 2, 3, 4, 5, 6, 7], df: '00:00', du: '00:01' }),
      secretKey,
    );
    expect(validateOffline(token, context)).toMatchObject({ reason: 'OUT_OF_SCHEDULE' });
  });

  it('deniega con ALREADY_USED cuando el cupo local esta agotado', () => {
    const token = makeToken(basePayload({ m: 2 }), secretKey);
    const exhausted = makeContext({
      keys: { a1b2c3d4: publicKey },
      localUses: () => 2,
    });
    expect(validateOffline(token, exhausted)).toMatchObject({ reason: 'ALREADY_USED' });
  });
});

describe('validateOffline - needs_enrollment', () => {
  const secretKey = utils.randomSecretKey();
  const publicKey = toBase64Url(getPublicKey(secretKey));
  const keys = { a1b2c3d4: publicKey };

  it('devuelve needs_enrollment con el invitationId cuando el pase es valido pero el invitado nunca fue enrolado', () => {
    const payload = basePayload();
    const token = makeToken(payload, secretKey);
    const ctx = makeContext({ keys, isEnrolled: () => false });
    expect(validateOffline(token, ctx)).toEqual({
      status: 'needs_enrollment',
      subject: { kind: 'guest', invitationId: payload.i },
    });
  });

  it('permite en scans posteriores del mismo invitationId', () => {
    const payload = basePayload();
    const token = makeToken(payload, secretKey);
    const ctx = makeContext({
      keys,
      isEnrolled: (invitationId) => invitationId === payload.i,
    });
    expect(validateOffline(token, ctx)).toEqual({ status: 'allowed' });
  });

  // Blindaje de orden: cada motivo de denegacion offline con isEnrolled=false.
  // Si un guard nuevo se cuela antes de la firma o del resto de checks,
  // needs_enrollment se filtra donde no debe y este bloque lo detecta.
  const revokedJti = '8f3c9a2e-1111-4222-8333-444455556666';
  const otherWeekday = (() => {
    const weekday = ((new Date(NOW * 1000).getDay() + 6) % 7) + 1;
    return [1, 2, 3, 4, 5, 6, 7].filter((day) => day !== weekday);
  })();

  const guardCases: {
    name: string;
    token: string;
    ctx: OfflineContext;
    expected: { status: 'denied'; reason: string };
  }[] = [
    {
      name: 'INVALID_SIGNATURE - token malformado',
      token: 'garbage',
      ctx: makeContext({ keys, isEnrolled: () => false }),
      expected: { status: 'denied', reason: 'INVALID_SIGNATURE' },
    },
    {
      name: 'INVALID_SIGNATURE - kid desconocido',
      token: makeToken(basePayload({ k: 'ffffffff' }), secretKey),
      ctx: makeContext({ keys, isEnrolled: () => false }),
      expected: { status: 'denied', reason: 'INVALID_SIGNATURE' },
    },
    {
      name: 'INVALID_SIGNATURE - RECURRING sin franja',
      token: makeToken(basePayload({ t: 'R' }), secretKey),
      ctx: makeContext({ keys, isEnrolled: () => false }),
      expected: { status: 'denied', reason: 'INVALID_SIGNATURE' },
    },
    {
      name: 'REVOKED',
      token: makeToken(basePayload({ j: revokedJti }), secretKey),
      ctx: makeContext({
        keys,
        isEnrolled: () => false,
        revoked: new Set([revokedJti]),
      }),
      expected: { status: 'denied', reason: 'REVOKED' },
    },
    {
      name: 'NOT_YET_VALID',
      token: makeToken(basePayload({ f: NOW + 60 }), secretKey),
      ctx: makeContext({ keys, isEnrolled: () => false }),
      expected: { status: 'denied', reason: 'NOT_YET_VALID' },
    },
    {
      name: 'EXPIRED',
      token: makeToken(basePayload({ u: NOW - 60 }), secretKey),
      ctx: makeContext({ keys, isEnrolled: () => false }),
      expected: { status: 'denied', reason: 'EXPIRED' },
    },
    {
      name: 'OUT_OF_SCHEDULE',
      token: makeToken(
        basePayload({ t: 'R', w: otherWeekday, df: '00:00', du: '23:59' }),
        secretKey,
      ),
      ctx: makeContext({ keys, isEnrolled: () => false }),
      expected: { status: 'denied', reason: 'OUT_OF_SCHEDULE' },
    },
    {
      name: 'ALREADY_USED',
      token: makeToken(basePayload({ m: 1 }), secretKey),
      ctx: makeContext({ keys, isEnrolled: () => false, localUses: () => 1 }),
      expected: { status: 'denied', reason: 'ALREADY_USED' },
    },
  ];

  it.each(guardCases)(
    'con isEnrolled=false, $name gana sobre needs_enrollment',
    ({ token, ctx, expected }) => {
      expect(validateOffline(token, ctx)).toMatchObject(expected);
    },
  );
});

describe('validateOffline - permitido', () => {
  const secretKey = utils.randomSecretKey();
  const context = makeContext({ keys: { a1b2c3d4: toBase64Url(getPublicKey(secretKey)) } });

  it('permite un pase valido dentro de ventana y cupo', () => {
    const token = makeToken(basePayload(), secretKey);
    expect(validateOffline(token, context)).toEqual({ status: 'allowed' });
  });

  it('permite en los bordes de la ventana y con cupo exacto disponible', () => {
    const atEdge = makeToken(basePayload({ f: NOW, u: NOW }), secretKey);
    expect(validateOffline(atEdge, makeContext({ now: NOW, keys: context.keys }))).toEqual({
      status: 'allowed',
    });

    const withCupo = makeToken(basePayload({ m: 2 }), secretKey);
    const oneLeft = makeContext({ keys: context.keys, localUses: () => 1 });
    expect(validateOffline(withCupo, oneLeft)).toEqual({ status: 'allowed' });
  });

  it('permite un RECURRING dentro de la franja', () => {
    const token = makeToken(
      basePayload({ t: 'R', w: [1, 2, 3, 4, 5, 6, 7], df: '00:00', du: '23:59' }),
      secretKey,
    );
    expect(validateOffline(token, context)).toEqual({ status: 'allowed' });
  });

  it('solo llega a allowed si todas las condiciones pasan', () => {
    const payload = basePayload();
    const valid = makeToken(payload, secretKey);
    expect(validateOffline(valid, context)).toEqual({ status: 'allowed' });

    // Si se agrega una condicion nueva al token, entra aca: ninguna falla
    // parcial puede caer en allowed.
    const failingCases: { name: string; token: string; ctx: OfflineContext }[] = [
      {
        name: 'firma',
        // Corrompe un byte significativo de la firma: el ultimo caracter
        // base64url solo codifica bits de padding y a veces decodifica
        // a la misma firma (el test era flaky).
        token: corruptCharAt(valid, valid.length - 40),
        ctx: context,
      },
      {
        name: 'revocado',
        token: valid,
        ctx: makeContext({ keys: context.keys, revoked: new Set([payload.j]) }),
      },
      {
        name: 'no vigente',
        token: makeToken(basePayload({ f: NOW + 60 }), secretKey),
        ctx: context,
      },
      {
        name: 'vencido',
        token: makeToken(basePayload({ u: NOW - 60 }), secretKey),
        ctx: context,
      },
      {
        name: 'sin cupo',
        token: makeToken(basePayload({ m: 2 }), secretKey),
        ctx: makeContext({ keys: context.keys, localUses: () => 2 }),
      },
    ];

    for (const failingCase of failingCases) {
      const decision = validateOffline(failingCase.token, failingCase.ctx);
      expect(decision, failingCase.name).toMatchObject({ status: 'denied' });
    }
  });
});

describe('parseToken', () => {
  it('devuelve null para tokens fuera de formato', () => {
    expect(parseToken('')).toBeNull();
    expect(parseToken('SP1.')).toBeNull();
    expect(parseToken('SP1.abc.def.ghi')).toBeNull();
    expect(parseToken('SP1.!!!!.!!!!')).toBeNull();
  });

  it('preserva los bytes crudos del payload firmado', () => {
    const payload = basePayload();
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const secretKey = utils.randomSecretKey();
    const token = `${TOKEN_PREFIX}${toBase64Url(payloadBytes)}.${toBase64Url(
      sign(payloadBytes, secretKey),
    )}`;
    const parsed = parseToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.payload).toEqual(payload);
  });
});

describe('densidad del payload', () => {
  it('mantiene el payload RECURRING completo por debajo de 300 bytes', () => {
    const worstCase = JSON.stringify(
      basePayload({
        t: 'R',
        m: 200,
        w: [1, 2, 3, 4, 5, 6, 7],
        df: '08:00',
        du: '18:00',
      }),
    );
    expect(worstCase.length).toBeLessThan(300);
  });
});

describe('token real emitido por el backend', () => {
  // Generado con QrTokenIssuer del backend (securepassb, commit f00ce91)
  // para un pase RECURRING con w/df/du: valida el formato real de Jackson
  // contra el parser del frontend, no un fixture armado a mano.
  const realToken =
    'SP1.eyJ2IjoxLCJrIjoiYWJjZDEyMzQiLCJqIjoiYjhlNWI3MzMtYjc5Yy00M2YzLWFkMTMtOTY5MGZjMGEzYjg5IiwibiI6ImYzZjAyN2U5LTdjZmYtNDkwMC1hNjdlLTlmNTMwNTlkNWRkZCIsImwiOiI3ZWFkZWQ4YS0wMDMzLTQxYTYtOWU4Zi02NzA2ZTI3NTI1N2QiLCJpIjoiOTUzOWQ2NjAtZDdiZS00NzUyLTlkMGEtOWFlZjhkYzRkMjk0IiwidCI6IlIiLCJmIjoxNzY3MjI1NjAwLCJ1IjoxNzk4NzYxNjAwLCJtIjoyMDAsInciOlsxLDIsMyw0LDUsNiw3XSwiZGYiOiIwMDowMCIsImR1IjoiMjM6NTkifQ.ufobC1Jp8tREZAu0B84ln7Y3pXlnkMaKoFX1zS24ql6feLauQM0-aozSW-03potyykZgr8RFo2e0584swwN-Cg';
  const realPublicKey = 'kC45ctdGfJ8w9djBDcwc3OCKC_OnsvcbKVmMYAlnzhA';

  it('parsea el payload recurrente y verifica la firma con la clave real', () => {
    const parsed = parseToken(realToken);
    expect(parsed?.payload).toMatchObject({
      t: 'R',
      w: [1, 2, 3, 4, 5, 6, 7],
      df: '00:00',
      du: '23:59',
      m: 200,
    });
  });

  it('valida offline el token real dentro de su ventana', () => {
    const decision = validateOffline(realToken, {
      now: 1780272000, // 2026-06-01, dentro de la ventana del token
      keys: { abcd1234: realPublicKey },
      revoked: new Set(),
      localUses: () => 0,
      isEnrolled: () => true,
      neighborhoodTimezone: 'America/Argentina/Mendoza',
      workerPermissions: () => [],
      isWorkerEnrolled: () => true,
    });
    expect(decision).toEqual({ status: 'allowed' });
  });
});

describe('isDuplicateScan', () => {
  const previous = { token: 'SP1.abc.def', at: 1000 };

  it('ignora el mismo token dentro de la ventana de 3 s', () => {
    expect(isDuplicateScan(previous, 'SP1.abc.def', 3999)).toBe(true);
  });

  it('acepta el mismo token fuera de la ventana', () => {
    expect(isDuplicateScan(previous, 'SP1.abc.def', 4000)).toBe(false);
  });

  it('acepta un token distinto dentro de la ventana', () => {
    expect(isDuplicateScan(previous, 'SP1.otro.def', 1500)).toBe(false);
  });

  it('acepta el primer escaneo', () => {
    expect(isDuplicateScan(null, 'SP1.abc.def', 1500)).toBe(false);
  });
});

describe('isDenialReason', () => {
  it('reconoce los motivos del enum', () => {
    expect(isDenialReason('REVOKED')).toBe(true);
    expect(isDenialReason('LOT_SUSPENDED')).toBe(true);
  });

  it('rechaza valores desconocidos', () => {
    expect(isDenialReason('garbage')).toBe(false);
    expect(isDenialReason(42)).toBe(false);
    expect(isDenialReason(null)).toBe(false);
  });
});

describe('toScanResult', () => {
  const TOKEN = 'SP1.dummy-token';

  it('mapea ALLOWED con invitado y lote', () => {
    const outcome = toScanResult(
      { result: 'ALLOWED', guest: { name: 'Maria Lopez' }, lot: { code: 'M4-L12' } },
      TOKEN,
    );
    expect(outcome).toEqual({
      kind: 'result',
      value: { status: 'allowed', guestName: 'Maria Lopez', lotCode: 'M4-L12' },
    });
  });

  it('mapea ALLOWED sin invitado con nulls (offline no tiene nombre)', () => {
    expect(toScanResult({ result: 'ALLOWED' }, TOKEN)).toEqual({
      kind: 'result',
      value: { status: 'allowed', guestName: null, lotCode: null },
    });
  });

  it('mapea DENIED con motivo conocido y mensaje', () => {
    const outcome = toScanResult({ result: 'DENIED', reason: 'ALREADY_USED' }, TOKEN);
    expect(outcome).toMatchObject({
      kind: 'result',
      value: { status: 'denied', reason: 'ALREADY_USED' },
    });
    expect(outcome).toHaveProperty('value.message');
  });

  it('mapea DENIED con motivo desconocido a UNKNOWN', () => {
    const outcome = toScanResult({ result: 'DENIED', reason: 'otra-cosa' }, TOKEN);
    expect(outcome).toMatchObject({
      kind: 'result',
      value: { status: 'denied', reason: 'UNKNOWN' },
    });
  });

  it('mapea NEEDS_ENROLLMENT preservando invitationId, token, lotCode y guestName del server', () => {
    const outcome = toScanResult(
      {
        result: 'NEEDS_ENROLLMENT',
        invitationId: 'inv-123',
        lot: { code: 'A-14' },
        guest: { name: 'Maria Lopez' },
      },
      TOKEN,
    );
    expect(outcome).toEqual({
      kind: 'result',
      value: {
        status: 'needs_enrollment',
        subject: { kind: 'guest', invitationId: 'inv-123' },
        token: TOKEN,
        lotCode: 'A-14',
        guestName: 'Maria Lopez',
        offlineScan: null,
        lots: [],
      },
    });
  });

  it('NEEDS_ENROLLMENT sin guest deja guestName en null (server viejo o rama sin nombre)', () => {
    const outcome = toScanResult(
      { result: 'NEEDS_ENROLLMENT', invitationId: 'inv-123' },
      TOKEN,
    );
    expect(outcome).toEqual({
      kind: 'result',
      value: {
        status: 'needs_enrollment',
        subject: { kind: 'guest', invitationId: 'inv-123' },
        token: TOKEN,
        lotCode: null,
        guestName: null,
        offlineScan: null,
        lots: [],
      },
    });
  });

  // E (#115): trabajador con red.
  it('ALLOWED_WORKER mapea a allowed con nombre y lote del trabajador', () => {
    const outcome = toScanResult(
      {
        result: 'ALLOWED_WORKER',
        worker: { userId: 'w-1', name: 'Wanda', lots: [{ lotId: 'l-1', code: 'A-001', service: 'Jardineria' }] },
      },
      TOKEN,
    );
    expect(outcome).toEqual({
      kind: 'result',
      value: { status: 'allowed', guestName: 'Wanda', lotCode: 'A-001' },
    });
  });

  it('NEEDS_ENROLLMENT de trabajador lleva userId, nombre y los lotes en franja', () => {
    const outcome = toScanResult(
      {
        result: 'NEEDS_ENROLLMENT',
        subjectKind: 'WORKER',
        worker: {
          userId: 'w-1',
          name: 'Wanda',
          lots: [
            { lotId: 'l-1', code: 'A-001', service: 'Jardineria' },
            { lotId: 'l-2', code: 'B-7', service: 'Limpieza' },
          ],
        },
      },
      TOKEN,
    );
    expect(outcome).toEqual({
      kind: 'result',
      value: {
        status: 'needs_enrollment',
        subject: { kind: 'worker', userId: 'w-1' },
        token: TOKEN,
        lotCode: null,
        guestName: 'Wanda',
        offlineScan: null,
        lots: [
          { lotId: 'l-1', code: 'A-001' },
          { lotId: 'l-2', code: 'B-7' },
        ],
      },
    });
  });

  it('NEEDS_ENROLLMENT de trabajador sin userId cae a unknown (fail-closed)', () => {
    const outcome = toScanResult({ result: 'NEEDS_ENROLLMENT', subjectKind: 'WORKER', worker: {} }, TOKEN);
    expect(outcome).toEqual({ kind: 'unknown', result: 'NEEDS_ENROLLMENT' });
  });

  it('NEEDS_ENROLLMENT sin invitationId cae a unknown (fail-closed, no offline)', () => {
    const outcome = toScanResult({ result: 'NEEDS_ENROLLMENT' }, TOKEN);
    expect(outcome).toEqual({ kind: 'unknown', result: 'NEEDS_ENROLLMENT' });
  });

  it('un result que no reconocemos devuelve unknown (fail-closed, NO offline)', () => {
    const outcome = toScanResult({ result: 'PENDING_APPROVAL' }, TOKEN);
    expect(outcome).toEqual({ kind: 'unknown', result: 'PENDING_APPROVAL' });
  });

  // securepassb#218: trabajador con varios lotes en franja. Hasta que el
  // scanner con red maneje trabajadores (E) y exista el picker (F), tiene
  // que caer en unknown: ni allowed, ni needs_enrollment, ni empty (que
  // dispararia el offline). La respuesta trae worker.lots, que no debe
  // confundirse con un ingreso.
  it('NEEDS_LOT_SELECTION de trabajador devuelve unknown (fail-closed hasta E y F)', () => {
    const outcome = toScanResult(
      {
        result: 'NEEDS_LOT_SELECTION',
        subjectKind: 'WORKER',
        worker: {
          userId: 'user-w',
          name: 'Carlos Diaz',
          lots: [
            { lotId: 'lot-1', code: 'L-1' },
            { lotId: 'lot-2', code: 'L-2' },
          ],
        },
      },
      TOKEN,
    );
    expect(outcome).toEqual({ kind: 'unknown', result: 'NEEDS_LOT_SELECTION' });
  });

  it('respuesta sin result devuelve empty (caller puede caer al offline)', () => {
    expect(toScanResult({}, TOKEN)).toEqual({ kind: 'empty' });
  });
});

describe('formatDni', () => {
  it('formatea 8 digitos con puntos cada 3 desde la derecha', () => {
    expect(formatDni('23456789')).toBe('23.456.789');
  });

  it('formatea 7 digitos', () => {
    expect(formatDni('1234567')).toBe('1.234.567');
  });

  it('formatea 6 digitos (documentos viejos)', () => {
    expect(formatDni('123456')).toBe('123.456');
  });

  it('formatea 9 digitos (documentos nuevos)', () => {
    expect(formatDni('123456789')).toBe('123.456.789');
  });

  it('devuelve el input sin tocar si tiene no-digitos (defensa)', () => {
    expect(formatDni('12A45678')).toBe('12A45678');
    expect(formatDni('')).toBe('');
  });
});

describe('parseArgentineDni', () => {
  it('parsea el formato Nueva DNI con @ inicial', () => {
    const raw = '@00434320@GONZALEZ@MARIA LAURA@F@23456789@A@15/10/1985@21/03/2015@CUIL';
    expect(parseArgentineDni(raw)).toEqual({
      document: '23456789',
      lastName: 'GONZALEZ',
      firstName: 'MARIA LAURA',
      gender: 'F',
      birthDate: '15/10/1985',
    });
  });

  it('parsea el formato sin @ inicial', () => {
    const raw = '00434320@PEREZ@JUAN@M@12345678@A@01/01/1990@01/01/2020';
    expect(parseArgentineDni(raw)).toMatchObject({
      document: '12345678',
      lastName: 'PEREZ',
      firstName: 'JUAN',
      gender: 'M',
      birthDate: '01/01/1990',
    });
  });

  it('parsea el formato viejo, sin nro de tramite al frente', () => {
    // Tarjeta previa al 2009: no tiene el campo nro de tramite; el DNI
    // cae en indice 3 en vez de 4. El parser tiene que usar el sexo
    // como ancla posicional para funcionar en ambas versiones.
    const raw = 'DIAZ@ROBERTO@M@25999888@A@10/07/1975@10/07/2000';
    expect(parseArgentineDni(raw)).toEqual({
      document: '25999888',
      lastName: 'DIAZ',
      firstName: 'ROBERTO',
      gender: 'M',
      birthDate: '10/07/1975',
    });
  });

  it('tolera espacios y separadores raros del lector', () => {
    const raw = ' 00434320 @  RODRIGUEZ @ ANA MARIA @ F @ 30111222 @ A @ 10/05/1980 ';
    expect(parseArgentineDni(raw)?.document).toBe('30111222');
    expect(parseArgentineDni(raw)?.lastName).toBe('RODRIGUEZ');
  });

  it('deja null la fecha si viene fuera de formato pero mantiene los demas datos', () => {
    const raw = '00434320@LOPEZ@JOSE@M@12345678@A@1990-01-01@01/01/2020';
    expect(parseArgentineDni(raw)).toMatchObject({
      document: '12345678',
      gender: 'M',
      birthDate: null,
    });
  });

  it('rechaza si el sexo no es M ni F, para caer al ingreso manual', () => {
    // El sexo es el ancla posicional del parser. Sin ancla no se puede
    // decidir donde esta el DNI y devolver algo seria mandar basura al
    // backend: mejor null y cae a manual.
    const raw = '00434320@LOPEZ@JOSE@X@12345678@A@01/01/1990@01/01/2020';
    expect(parseArgentineDni(raw)).toBeNull();
  });

  it('rechaza si el documento no parece numerico', () => {
    const raw = '00434320@LOPEZ@JOSE@M@ABCDE@A@01/01/1990@01/01/2020';
    expect(parseArgentineDni(raw)).toBeNull();
  });

  it('rechaza payloads con muy pocos campos', () => {
    expect(parseArgentineDni('')).toBeNull();
    expect(parseArgentineDni('@LOPEZ@JOSE')).toBeNull();
    expect(parseArgentineDni('random qr content')).toBeNull();
  });
});

// Bug #64: withinDailySlot evaluaba franja con la tz del dispositivo.
// La migracion a scheduleContains + neighborhoodTimezone lo cierra: el
// mismo instante en Mza vs Tokio ahora da veredictos distintos con la
// misma ventana, y sin tz configurada no se cae a la tz del sistema.
describe('validateOffline - RECURRING usa la tz del barrio (#64)', () => {
  const secretKey = utils.randomSecretKey();
  const publicKey = toBase64Url(getPublicKey(secretKey));

  // 2026-03-03 13:00 UTC (martes): 10:00 en Mza, 22:00 en Tokio.
  const INSTANT_TUE_1300Z = Math.floor(new Date('2026-03-03T13:00:00Z').getTime() / 1000);

  function recurringPayload(): InvitationPayload {
    return basePayload({
      t: 'R',
      f: INSTANT_TUE_1300Z - 3600,
      u: INSTANT_TUE_1300Z + 3600,
      w: [2],
      df: '08:00',
      du: '12:00',
    });
  }

  it('permite con tz Mza cuando el instante cae en la franja local', () => {
    const token = makeToken(recurringPayload(), secretKey);
    const ctx = makeContext({
      keys: { a1b2c3d4: publicKey },
      now: INSTANT_TUE_1300Z,
      neighborhoodTimezone: 'America/Argentina/Mendoza',
    });
    expect(validateOffline(token, ctx)).toEqual({ status: 'allowed' });
  });

  it('deniega OUT_OF_SCHEDULE con tz Tokio para el mismo instante y ventana', () => {
    const token = makeToken(recurringPayload(), secretKey);
    const ctx = makeContext({
      keys: { a1b2c3d4: publicKey },
      now: INSTANT_TUE_1300Z,
      neighborhoodTimezone: 'Asia/Tokyo',
    });
    expect(validateOffline(token, ctx)).toMatchObject({ reason: 'OUT_OF_SCHEDULE' });
  });

  // Payload 'R' construido a mano al que le falta w/df/du. Antes del fix
  // el codigo hacia payload.w!/df!/du! y crasheaba al pasarlos a
  // scheduleContains — un token con este shape emitido por un backend
  // roto (o por un atacante que se saltee parseToken) tiraba el scanner.
  // Ahora el guard devuelve false y el flujo denega, no crashea.
  it('isWithinRecurringSchedule fail-closed con payload R sin franja', () => {
    const ctx = makeContext({ neighborhoodTimezone: 'America/Argentina/Mendoza' });
    const sinCampos: InvitationPayload = basePayload({ t: 'R' });
    const sinDias: InvitationPayload = basePayload({ t: 'R', df: '08:00', du: '12:00' });
    const sinFrom: InvitationPayload = basePayload({ t: 'R', w: [2], du: '12:00' });
    const sinUntil: InvitationPayload = basePayload({ t: 'R', w: [2], df: '08:00' });
    const diasVacios: InvitationPayload = basePayload({ t: 'R', w: [], df: '08:00', du: '12:00' });
    expect(isWithinRecurringSchedule(sinCampos, ctx)).toBe(false);
    expect(isWithinRecurringSchedule(sinDias, ctx)).toBe(false);
    expect(isWithinRecurringSchedule(sinFrom, ctx)).toBe(false);
    expect(isWithinRecurringSchedule(sinUntil, ctx)).toBe(false);
    expect(isWithinRecurringSchedule(diasVacios, ctx)).toBe(false);
  });

  it('deniega NEIGHBORHOOD_TZ_MISSING cuando falta la tz del barrio (no OUT_OF_SCHEDULE ni UNKNOWN)', () => {
    // Sin tz configurada la franja no se puede evaluar. El motivo tiene
    // que ser explicito: NEIGHBORHOOD_TZ_MISSING le dice al guardia que la
    // config falta (mensaje dedicado en DENIAL_MESSAGES); OUT_OF_SCHEDULE
    // mentiria diciendo "la ventana no case" y UNKNOWN seria generico.
    const token = makeToken(recurringPayload(), secretKey);
    const ctx = makeContext({
      keys: { a1b2c3d4: publicKey },
      now: INSTANT_TUE_1300Z,
      neighborhoodTimezone: null,
    });
    expect(validateOffline(token, ctx)).toMatchObject({ reason: 'NEIGHBORHOOD_TZ_MISSING' });
  });
});

describe('validateOffline - trabajador (WBS-118)', () => {
  const secretKey = utils.randomSecretKey();
  const keys = { a1b2c3d4: toBase64Url(getPublicKey(secretKey)) };
  const USER = '5a4b3c2d-5555-4666-8777-888899990000';
  const JTI = '1f2e3d4c-6666-4777-9888-999900001111';
  // Martes 13:00Z: 10:00 en Mendoza (dentro de 08-12), 22:00 en Tokio (fuera).
  const TUE_1300Z = Math.floor(new Date('2026-03-03T13:00:00Z').getTime() / 1000);

  const workerToken = (overrides: Record<string, unknown> = {}) => {
    const payload = { v: 1, k: 'a1b2c3d4', j: JTI, n: 'b1a2c3d4-2222-4333-9444-555566667777', st: 'W', s: USER, ...overrides };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    return `${TOKEN_PREFIX}${toBase64Url(bytes)}.${toBase64Url(sign(bytes, secretKey))}`;
  };

  const permission = (overrides: Partial<WorkerPermission> = {}): WorkerPermission => ({
    jti: JTI,
    lotCode: 'M4-L12',
    weekdays: [2],
    dailyFrom: '08:00',
    dailyUntil: '12:00',
    timezone: 'America/Argentina/Mendoza',
    ...overrides,
  });

  const ctxWith = (permissions: WorkerPermission[], overrides: Partial<OfflineContext> = {}) =>
    makeContext({
      keys,
      now: TUE_1300Z,
      workerPermissions: (userId) => (userId === USER ? permissions : []),
      ...overrides,
    });

  it('en franja, enrolado y sincronizado entra y devuelve los lotes en franja', () => {
    expect(validateOffline(workerToken(), ctxWith([permission()]))).toEqual({
      status: 'allowed_worker',
      lotCodes: ['M4-L12'],
    });
  });

  it('con varios lotes devuelve solo los que estan en franja', () => {
    const ctx = ctxWith([
      permission({ lotCode: 'M4-L12' }),
      permission({ lotCode: 'M7-L03', dailyFrom: '14:00', dailyUntil: '18:00' }),
      permission({ lotCode: 'M9-L01', weekdays: [2, 3] }),
    ]);
    expect(validateOffline(workerToken(), ctx)).toEqual({
      status: 'allowed_worker',
      lotCodes: ['M4-L12', 'M9-L01'],
    });
  });

  it('evalua la franja con la tz de la fila, no con la de la sesion', () => {
    // Sesion en Mendoza, fila en Tokio: el mismo instante queda fuera.
    const tokio = ctxWith([permission({ timezone: 'Asia/Tokyo' })]);
    expect(validateOffline(workerToken(), tokio)).toMatchObject({ reason: 'OUT_OF_SCHEDULE' });
    // Sesion sin tz, fila en Mendoza: entra igual.
    const sinTzDeSesion = ctxWith([permission()], { neighborhoodTimezone: null });
    expect(validateOffline(workerToken(), sinTzDeSesion)).toMatchObject({ status: 'allowed_worker' });
  });

  it('fuera de franja deniega OUT_OF_SCHEDULE', () => {
    const ctx = ctxWith([permission({ weekdays: [1, 3, 4, 5, 6, 7] })]);
    expect(validateOffline(workerToken(), ctx)).toMatchObject({ reason: 'OUT_OF_SCHEDULE' });
  });

  it('fila sin tz deniega NEIGHBORHOOD_TZ_MISSING', () => {
    const ctx = ctxWith([permission({ timezone: null })]);
    expect(validateOffline(workerToken(), ctx)).toMatchObject({ reason: 'NEIGHBORHOOD_TZ_MISSING' });
  });

  it('sin permisos en cache deniega WORKER_NOT_SYNCED con el copy acordado', () => {
    expect(validateOffline(workerToken(), ctxWith([]))).toEqual({
      status: 'denied',
      reason: 'WORKER_NOT_SYNCED',
      message: 'Este trabajador todavía no está cargado en este dispositivo. Registrá el ingreso manualmente.',
    });
  });

  it('permisos de otro jti (cache viejo o token rotado) deniega WORKER_NOT_SYNCED', () => {
    const ctx = ctxWith([permission({ jti: '00000000-0000-4000-8000-000000000000' })]);
    expect(validateOffline(workerToken(), ctx)).toMatchObject({ reason: 'WORKER_NOT_SYNCED' });
  });

  it('jti revocado deniega REVOKED aunque el cache lo tenga en franja', () => {
    const ctx = ctxWith([permission()], { revoked: new Set([JTI]) });
    expect(validateOffline(workerToken(), ctx)).toMatchObject({ reason: 'REVOKED' });
  });

  it('no enrolado pide DNI del trabajador', () => {
    const ctx = ctxWith([permission()], { isWorkerEnrolled: () => false });
    expect(validateOffline(workerToken(), ctx)).toEqual({
      status: 'needs_enrollment',
      subject: { kind: 'worker', userId: USER },
    });
  });

  it('no enrolado y fuera de franja deniega antes de pedir DNI', () => {
    const ctx = ctxWith([permission({ weekdays: [1] })], { isWorkerEnrolled: () => false });
    expect(validateOffline(workerToken(), ctx)).toMatchObject({ reason: 'OUT_OF_SCHEDULE' });
  });

  it.each([
    ['subType desconocido', { st: 'X' }],
    ['sin sub', { s: undefined }],
    ['con campos de invitacion', { i: '7e6f5d4c-4444-4555-b666-777788889999' }],
    ['con cupo', { m: 1 }],
  ])('token W malformado (%s) deniega INVALID_SIGNATURE', (_, overrides) => {
    expect(validateOffline(workerToken(overrides), ctxWith([permission()]))).toMatchObject({
      reason: 'INVALID_SIGNATURE',
    });
  });

  it('firmado por otra clave deniega INVALID_SIGNATURE', () => {
    const otra = makeContext({
      keys: { a1b2c3d4: toBase64Url(getPublicKey(utils.randomSecretKey())) },
      now: TUE_1300Z,
      workerPermissions: () => [permission()],
    });
    expect(validateOffline(workerToken(), otra)).toMatchObject({ reason: 'INVALID_SIGNATURE' });
  });
});
