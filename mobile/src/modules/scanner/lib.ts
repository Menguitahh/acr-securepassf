import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

import type { components } from '@securepass/contracts';

import { DENIAL_MESSAGES, DUPLICATE_WINDOW_MS, TOKEN_PREFIX } from '@/modules/scanner/data';
import { scheduleContains } from '@/modules/scanner/schedule-window';
import type {
  AccessDecision,
  DenialReason,
  DniData,
  InvitationPayload,
  OfflineContext,
  OfflineDenialReason,
  ParsedToken,
  ScanResult,
  TokenPayload,
  WorkerPayload,
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

const INVITATION_FIELDS = ['l', 'i', 't', 'f', 'u', 'm'] as const;

function isTokenPayload(value: unknown): value is TokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  if (!('v' in value) || typeof value.v !== 'number') return false;
  if (!('k' in value) || typeof value.k !== 'string') return false;
  if (!('j' in value) || typeof value.j !== 'string') return false;
  if (!('n' in value) || typeof value.n !== 'string') return false;
  if (value.v !== 1) return false;
  // subType (WBS-116): ausente es invitacion, 'W' es trabajador. Cualquier
  // otro valor es un formato que esta version no sabe validar.
  if ('st' in value) return isWorkerPayload(value);
  return isInvitationPayload(value);
}

// Mismas invariantes que QrTokenPayload del backend: el trabajador lleva
// sub y ninguno de los campos de invitacion.
function isWorkerPayload(value: object): value is WorkerPayload {
  if (!('st' in value) || value.st !== 'W') return false;
  if (!('s' in value) || typeof value.s !== 'string') return false;
  return INVITATION_FIELDS.every((field) => !(field in value));
}

function isInvitationPayload(value: object): value is InvitationPayload {
  if (!('l' in value) || typeof value.l !== 'string') return false;
  if (!('i' in value) || typeof value.i !== 'string') return false;
  if (!('t' in value) || (value.t !== 'S' && value.t !== 'E' && value.t !== 'R')) {
    return false;
  }
  if (!('f' in value) || typeof value.f !== 'number') return false;
  if (!('u' in value) || typeof value.u !== 'number') return false;
  if (!('m' in value) || typeof value.m !== 'number') return false;
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

// Exportado para tests: el guard defiende ante llamadores que bypasseen
// parseToken (payload construido a mano) o ante un futuro subtype que
// haga la franja opcional. Fail-closed: si falta cualquier pieza, false.
export function isWithinRecurringSchedule(payload: InvitationPayload, ctx: OfflineContext): boolean {
  if (!payload.w || payload.w.length === 0) return false;
  if (!payload.df || !payload.du) return false;
  if (!ctx.neighborhoodTimezone) return false;
  return scheduleContains(
    { weekdays: payload.w, dailyFrom: payload.df, dailyUntil: payload.du },
    ctx.now,
    ctx.neighborhoodTimezone,
  );
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
  if (parsed.payload.st === 'W') return validateWorkerOffline(parsed.payload, ctx);
  return validateInvitationOffline(parsed.payload, ctx);
}

function validateInvitationOffline(payload: InvitationPayload, ctx: OfflineContext): AccessDecision {
  if (ctx.now < payload.f) return denied('NOT_YET_VALID');
  if (ctx.now > payload.u) return denied('EXPIRED');
  if (payload.t === 'R') {
    // Sin tz del barrio configurada no se puede evaluar la franja. No es
    // que la ventana no case: no la podemos calcular. Motivo dedicado
    // para que el mensaje al guardia sea especifico (no un UNKNOWN generico).
    if (!ctx.neighborhoodTimezone) return denied('NEIGHBORHOOD_TZ_MISSING');
    if (!isWithinRecurringSchedule(payload, ctx)) return denied('OUT_OF_SCHEDULE');
  }
  if (ctx.localUses(payload.j) >= payload.m) {
    return denied('ALREADY_USED');
  }
  // Sin enrolamiento previo el guardia debe capturar el DNI antes de
  // permitir el ingreso: US-36. Es un guard clause posterior al resto
  // porque si el pase esta vencido/revocado/sin cupo no vale la pena
  // enrolar a nadie.
  if (!ctx.isEnrolled(payload.i)) {
    return { status: 'needs_enrollment', subject: { kind: 'guest', invitationId: payload.i } };
  }

  // Allowed explicito: espeja las condiciones de los guards. Si una
  // condicion nueva se agrega al token y se olvida el guard, no entra aca.
  const noRevocado = !ctx.revoked.has(payload.j);
  const dentroDeVentana = ctx.now >= payload.f && ctx.now <= payload.u;
  const enFranja =
    payload.t !== 'R' ||
    (!!ctx.neighborhoodTimezone && isWithinRecurringSchedule(payload, ctx));
  const cupoDisponible = ctx.localUses(payload.j) < payload.m;
  const enrolado = ctx.isEnrolled(payload.i);
  if (noRevocado && dentroDeVentana && enFranja && cupoDisponible && enrolado) {
    return { status: 'allowed' };
  }

  // Fail-closed: el default es denegar. El costo de un falso permitido es
  // un desconocido adentro; el de un falso denegado, un registro manual.
  return denied('UNKNOWN');
}

// Rama del trabajador (WBS-118). El token no trae ventana ni lote: todo
// sale del cache de permisos. Firma y revocacion ya se chequearon.
function validateWorkerOffline(payload: WorkerPayload, ctx: OfflineContext): AccessDecision {
  // Solo cuentan los permisos emitidos con este jti. Otro jti es un cache
  // viejo o un token rotado: desde el dispositivo no se distinguen, y en
  // los dos casos lo seguro es no dejar pasar.
  const permissions = ctx.workerPermissions(payload.s).filter((p) => p.jti === payload.j);
  if (!permissions.length) return denied('WORKER_NOT_SYNCED');

  const inWindow: string[] = [];
  for (const p of permissions) {
    // Sin la tz de la fila la franja no se puede calcular (misma razon que
    // en la rama de invitacion): motivo dedicado, no OUT_OF_SCHEDULE.
    if (!p.timezone) return denied('NEIGHBORHOOD_TZ_MISSING');
    const window = { weekdays: p.weekdays, dailyFrom: p.dailyFrom, dailyUntil: p.dailyUntil };
    if (scheduleContains(window, ctx.now, p.timezone)) inWindow.push(p.lotCode);
  }
  if (!inWindow.length) return denied('OUT_OF_SCHEDULE');

  // Igual que el invitado: sin DNI verificado no entra (WBS-122).
  if (!ctx.isWorkerEnrolled(payload.s)) {
    return { status: 'needs_enrollment', subject: { kind: 'worker', userId: payload.s } };
  }
  return { status: 'allowed_worker', lotCodes: inWindow };
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
  'NEIGHBORHOOD_TZ_MISSING',
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

export type ToScanResultOutcome =
  // Server respondio con un result que sabemos mapear -> se usa tal cual.
  | { kind: 'result'; value: ScanResult }
  // Server no emitio result (respuesta vacia / malformada benigna) ->
  // el caller puede caer al offline como fallback.
  | { kind: 'empty' }
  // Server emitio un result que no reconocemos -> fail-closed a denied.
  // NUNCA cae al offline: el server ya dio una respuesta, respetarla
  // (aunque no la entendamos) es mas seguro que pisarla con un cache
  // local que ni siquiera sabe que decision computar.
  | { kind: 'unknown'; result: string };

// Guard interno mientras ValidateAccessResponse.result sea `string` libre
// en el contrato (securepassb#170). Cuando pase a enum
// ALLOWED | DENIED | NEEDS_ENROLLMENT, este switch se vuelve exhaustivo
// por tipos y la rama `unknown` (junto con este comentario) se borra:
// el compilador va a forzar manejar cualquier valor nuevo del server.
export function toScanResult(
  response: components['schemas']['ValidateAccessResponse'],
  token: string,
): ToScanResultOutcome {
  if (response.result === 'ALLOWED') {
    return {
      kind: 'result',
      value: {
        status: 'allowed',
        guestName: response.guest?.name ?? null,
        lotCode: response.lot?.code ?? null,
      },
    };
  }
  if (response.result === 'DENIED') {
    const reason = isDenialReason(response.reason) ? response.reason : 'UNKNOWN';
    return { kind: 'result', value: { status: 'denied', reason, message: DENIAL_MESSAGES[reason] } };
  }
  if (response.result === 'NEEDS_ENROLLMENT') {
    // Sin invitationId, la respuesta esta rota estructuralmente: el
    // enrolamiento no se puede encarar. Tratar como desconocida en vez
    // de asumir un invitationId vacio. La rama WORKER (securepassb#175)
    // cae aca hasta que definamos el flujo — es fail-closed intencional.
    if (!response.invitationId) return { kind: 'unknown', result: 'NEEDS_ENROLLMENT' };
    return {
      kind: 'result',
      value: {
        status: 'needs_enrollment',
        subject: { kind: 'guest', invitationId: response.invitationId },
        token,
        lotCode: response.lot?.code ?? null,
        guestName: response.guest?.name ?? null,
      },
    };
  }
  if (typeof response.result === 'string' && response.result.length > 0) {
    // Un result que no reconocemos NO cae al offline: fail-closed a denied.
    // Si esto salta en produccion, el fix es agregar el nuevo result aca,
    // no relajar el guard. Ver #98.
    return { kind: 'unknown', result: response.result };
  }
  return { kind: 'empty' };
}

const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

// PDF417 del DNI argentino. Existen dos formatos que circulan:
//
//   Nuevo (tarjeta 2009+):
//     tramite @ apellido @ nombres @ sexo @ dni @ ejemplar @ fecNac @ fecEmision [ @ CUIL ]
//
//   Viejo (previo al tramite): sin campo tramite al frente:
//     apellido @ nombres @ sexo @ dni @ ejemplar @ fecNac @ fecEmision
//
// El sexo (M/F) es la marca posicional confiable: apellido y nombres
// siempre estan antes, DNI siempre esta despues. Se ubica su indice y
// se derivan los demas relativos a el. Asi la funcion es indiferente
// al formato y a los @ vacios que algunos lectores agregan al frente.
// Formato AR: puntos cada 3 digitos desde la derecha ("23456789" -> "23.456.789").
// El parser ya garantiza 6-9 digitos, pero se defiende igual: si entra
// algo no numerico se devuelve tal cual, la pantalla no tira error.
export function formatDni(document: string): string {
  if (!/^\d+$/.test(document)) return document;
  return document.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseArgentineDni(raw: string): DniData | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const parts = raw
    .split('@')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const genderIndex = parts.findIndex((part) => part === 'M' || part === 'F');
  if (genderIndex < 2) return null;

  const lastName = parts[genderIndex - 2];
  const firstName = parts[genderIndex - 1];
  const document = parts[genderIndex + 1];
  if (!lastName || !firstName || !document) return null;
  if (!/^\d{6,9}$/.test(document)) return null;

  const gender = parts[genderIndex] === 'M' ? 'M' : 'F';
  const birthDateCandidate = parts[genderIndex + 3];
  const birthDate =
    birthDateCandidate && DATE_PATTERN.test(birthDateCandidate)
      ? birthDateCandidate
      : null;

  return { document, lastName, firstName, gender, birthDate };
}
