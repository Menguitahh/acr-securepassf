import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

import type { components } from '@securepass/contracts';

import { DENIAL_MESSAGES, DUPLICATE_WINDOW_MS, TOKEN_PREFIX } from '@/modules/scanner/data';
import type {
  AccessDecision,
  DenialReason,
  OfflineContext,
  OfflineDenialReason,
  ParsedToken,
  ScanResult,
  TokenPayload,
} from '@/modules/scanner/types';

// @noble/ed25519 v3 no incluye implementacion de hash: se configura una vez.
ed.hashes.sha512 = sha512;

const TIME_PATTERN = /^\d{2}:\d{2}$/;

function decodeBase64Url(value: string): Uint8Array | null {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function isTokenPayload(value: unknown): value is TokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  if (!('v' in value) || typeof value.v !== 'number') return false;
  if (!('k' in value) || typeof value.k !== 'string') return false;
  if (!('j' in value) || typeof value.j !== 'string') return false;
  if (!('n' in value) || typeof value.n !== 'string') return false;
  if (!('l' in value) || typeof value.l !== 'string') return false;
  if (!('i' in value) || typeof value.i !== 'string') return false;
  if (!('t' in value) || (value.t !== 'S' && value.t !== 'E' && value.t !== 'R')) {
    return false;
  }
  if (!('f' in value) || typeof value.f !== 'number') return false;
  if (!('u' in value) || typeof value.u !== 'number') return false;
  if (!('m' in value) || typeof value.m !== 'number') return false;
  if (value.v !== 1) return false;
  // Forma del payload para RECURRING (spec 5.1): sin franja valida no se
  // puede evaluar OFFLINE_OUT_OF_SCHEDULE, el token se rechaza como invalido.
  if (value.t === 'R') {
    if (!('w' in value) || !Array.isArray(value.w) || value.w.length === 0) return false;
    if (
      !value.w.every(
        (day) => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7,
      )
    ) {
      return false;
    }
    if (!('df' in value) || typeof value.df !== 'string' || !TIME_PATTERN.test(value.df)) {
      return false;
    }
    if (!('du' in value) || typeof value.du !== 'string' || !TIME_PATTERN.test(value.du)) {
      return false;
    }
  }
  return true;
}

export function parseToken(token: string): ParsedToken | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const body = token.slice(TOKEN_PREFIX.length);
  const parts = body.split('.');
  if (parts.length !== 2) return null;

  const payloadPart = parts[0];
  const signaturePart = parts[1];
  if (!payloadPart || !signaturePart) return null;

  const payloadBytes = decodeBase64Url(payloadPart);
  const signature = decodeBase64Url(signaturePart);
  if (!payloadBytes || !signature) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  if (!isTokenPayload(payload)) return null;
  return { payload, payloadBytes, signature };
}

function verifySignature(parsed: ParsedToken, publicKeyBase64Url: string): boolean {
  const publicKey = decodeBase64Url(publicKeyBase64Url);
  if (!publicKey || publicKey.length !== 32) return false;
  try {
    return ed.verify(parsed.signature, parsed.payloadBytes, publicKey);
  } catch {
    return false;
  }
}

// ponytail: usa el timezone del dispositivo del guardia para la franja diaria;
// revisar si un barrio opera en un timezone distinto al del telefono de garita.
function withinDailySlot(payload: TokenPayload, nowEpochSeconds: number): boolean {
  const weekdays = payload.w;
  const dailyFrom = payload.df;
  const dailyUntil = payload.du;
  if (!weekdays || !dailyFrom || !dailyUntil) return false;

  const date = new Date(nowEpochSeconds * 1000);
  const weekday = ((date.getDay() + 6) % 7) + 1;
  if (!weekdays.includes(weekday)) return false;

  const minutes = date.getHours() * 60 + date.getMinutes();
  const [fromHours, fromMinutes] = dailyFrom.split(':');
  const [untilHours, untilMinutes] = dailyUntil.split(':');
  const from = Number(fromHours) * 60 + Number(fromMinutes);
  const until = Number(untilHours) * 60 + Number(untilMinutes);
  return minutes >= from && minutes <= until;
}

function denied(reason: OfflineDenialReason): AccessDecision {
  return { status: 'denied', reason, message: DENIAL_MESSAGES[reason] };
}

export function validateOffline(token: string, ctx: OfflineContext): AccessDecision {
  const parsed = parseToken(token);
  if (!parsed) return denied('INVALID_SIGNATURE');

  const key = ctx.keys[parsed.payload.k];
  if (!key) return denied('INVALID_SIGNATURE');
  if (!verifySignature(parsed, key)) return denied('INVALID_SIGNATURE');

  if (ctx.revoked.has(parsed.payload.j)) return denied('REVOKED');
  if (ctx.now < parsed.payload.f) return denied('NOT_YET_VALID');
  if (ctx.now > parsed.payload.u) return denied('EXPIRED');
  if (parsed.payload.t === 'R' && !withinDailySlot(parsed.payload, ctx.now)) {
    return denied('OUT_OF_SCHEDULE');
  }
  if (ctx.localUses(parsed.payload.j) >= parsed.payload.m) {
    return denied('ALREADY_USED');
  }
  // Sin enrolamiento previo el guardia debe capturar el DNI antes de
  // permitir el ingreso: US-36. Es un guard clause posterior al resto
  // porque si el pase esta vencido/revocado/sin cupo no vale la pena
  // enrolar a nadie.
  if (!ctx.isEnrolled(parsed.payload.i)) {
    return { status: 'needs_enrollment', invitationId: parsed.payload.i };
  }

  // Allowed explicito: espeja las condiciones de los guards. Si una
  // condicion nueva se agrega al token y se olvida el guard, no entra aca.
  const noRevocado = !ctx.revoked.has(parsed.payload.j);
  const dentroDeVentana = ctx.now >= parsed.payload.f && ctx.now <= parsed.payload.u;
  const enFranja =
    parsed.payload.t !== 'R' || withinDailySlot(parsed.payload, ctx.now);
  const cupoDisponible = ctx.localUses(parsed.payload.j) < parsed.payload.m;
  const enrolado = ctx.isEnrolled(parsed.payload.i);
  if (noRevocado && dentroDeVentana && enFranja && cupoDisponible && enrolado) {
    return { status: 'allowed' };
  }

  // Fail-closed: el default es denegar. El costo de un falso permitido es
  // un desconocido adentro; el de un falso denegado, un registro manual.
  return denied('UNKNOWN');
}

const DENIAL_REASONS: DenialReason[] = [
  'INVALID_SIGNATURE',
  'NOT_YET_VALID',
  'EXPIRED',
  'ALREADY_USED',
  'REVOKED',
  'OUT_OF_SCHEDULE',
  'LOT_SUSPENDED',
  'REPLAY',
  'UNKNOWN',
];

export function isDenialReason(value: unknown): value is DenialReason {
  return typeof value === 'string' && DENIAL_REASONS.some((reason) => reason === value);
}

export function isDuplicateScan(
  previous: { token: string; at: number } | null,
  token: string,
  now: number,
): boolean {
  if (!previous) return false;
  return previous.token === token && now - previous.at < DUPLICATE_WINDOW_MS;
}

export function toScanResult(
  response: components['schemas']['ValidateAccessResponse'],
): ScanResult | null {
  if (response.result === 'ALLOWED') {
    return {
      status: 'allowed',
      guestName: response.guest?.name ?? null,
      lotCode: response.lot?.code ?? null,
    };
  }
  if (response.result === 'DENIED') {
    const reason = isDenialReason(response.reason) ? response.reason : 'UNKNOWN';
    return { status: 'denied', reason, message: DENIAL_MESSAGES[reason] };
  }
  return null;
}
