export type DenialReason =
  | 'INVALID_SIGNATURE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'REVOKED'
  | 'OUT_OF_SCHEDULE'
  | 'LOT_SUSPENDED'
  | 'REPLAY'
  | 'UNKNOWN';

export type OfflineDenialReason =
  | 'INVALID_SIGNATURE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'REVOKED'
  | 'OUT_OF_SCHEDULE'
  | 'UNKNOWN';

export type TokenPayload = {
  v: number;
  k: string;
  j: string;
  n: string;
  l: string;
  i: string;
  t: 'S' | 'E' | 'R';
  f: number;
  u: number;
  m: number;
  w?: number[];
  df?: string;
  du?: string;
};

export type ParsedToken = {
  payload: TokenPayload;
  payloadBytes: Uint8Array;
  signature: Uint8Array;
};

export type OfflineContext = {
  now: number;
  keys: Record<string, string>;
  revoked: ReadonlySet<string>;
  localUses: (jti: string) => number;
  isEnrolled: (invitationId: string) => boolean;
};

export type AccessDecision =
  | { status: 'allowed' }
  | { status: 'needs_enrollment'; invitationId: string }
  | { status: 'denied'; reason: DenialReason; message: string };

export type ScanResult =
  | { status: 'allowed'; guestName: string | null; lotCode: string | null }
  | { status: 'needs_enrollment'; invitationId: string; token: string }
  | { status: 'denied'; reason: DenialReason; message: string };
