import { getPublicKey, sign, utils } from '@noble/ed25519';
import { describe, expect, it } from 'vitest';

import { TOKEN_PREFIX } from '@/modules/scanner/data';
import {
  isDenialReason,
  isDuplicateScan,
  parseToken,
  toScanResult,
  validateOffline,
} from '@/modules/scanner/lib';
import type { OfflineContext, TokenPayload } from '@/modules/scanner/types';

const NOW = 1755540000;

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

function basePayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
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
        token: `${valid.slice(0, -1)}${valid.endsWith('A') ? 'B' : 'A'}`,
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
    expect(parsed).not.toBeNull();
    expect(parsed?.payload.t).toBe('R');
    expect(parsed?.payload.w).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(parsed?.payload.df).toBe('00:00');
    expect(parsed?.payload.du).toBe('23:59');
    expect(parsed?.payload.m).toBe(200);
  });

  it('valida offline el token real dentro de su ventana', () => {
    const decision = validateOffline(realToken, {
      now: 1780272000, // 2026-06-01, dentro de la ventana del token
      keys: { abcd1234: realPublicKey },
      revoked: new Set(),
      localUses: () => 0,
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
  it('mapea ALLOWED con invitado y lote', () => {
    const result = toScanResult({
      result: 'ALLOWED',
      guest: { name: 'Maria Lopez' },
      lot: { code: 'M4-L12' },
    });
    expect(result).toEqual({
      status: 'allowed',
      guestName: 'Maria Lopez',
      lotCode: 'M4-L12',
    });
  });

  it('mapea ALLOWED sin invitado con nulls (offline no tiene nombre)', () => {
    expect(toScanResult({ result: 'ALLOWED' })).toEqual({
      status: 'allowed',
      guestName: null,
      lotCode: null,
    });
  });

  it('mapea DENIED con motivo conocido y mensaje', () => {
    const result = toScanResult({ result: 'DENIED', reason: 'ALREADY_USED' });
    expect(result).toMatchObject({ status: 'denied', reason: 'ALREADY_USED' });
    expect(result).toHaveProperty('message');
  });

  it('mapea DENIED con motivo desconocido a UNKNOWN', () => {
    const result = toScanResult({ result: 'DENIED', reason: 'otra-cosa' });
    expect(result).toMatchObject({ status: 'denied', reason: 'UNKNOWN' });
  });

  it('devuelve null para respuestas sin decision', () => {
    expect(toScanResult({})).toBeNull();
  });
});
