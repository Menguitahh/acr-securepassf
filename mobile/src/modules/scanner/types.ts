export type DenialReason =
  | 'INVALID_SIGNATURE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'REVOKED'
  | 'OUT_OF_SCHEDULE'
  | 'LOT_SUSPENDED'
  | 'REPLAY'
  | 'NEIGHBORHOOD_TZ_MISSING'
  | 'UNKNOWN';

export type OfflineDenialReason =
  | 'INVALID_SIGNATURE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'REVOKED'
  | 'OUT_OF_SCHEDULE'
  | 'NEIGHBORHOOD_TZ_MISSING'
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
  // IANA timezone del barrio para evaluar scheduleContains (issue #64).
  // Null cuando la sesion se abrio antes de que el backend enviara el
  // campo (securepassb#155): en pases RECURRING, validateOffline responde
  // NEIGHBORHOOD_TZ_MISSING en vez de asumir la tz del dispositivo.
  neighborhoodTimezone: string | null;
};

export type AccessDecision =
  | { status: 'allowed' }
  | { status: 'needs_enrollment'; invitationId: string }
  | { status: 'denied'; reason: DenialReason; message: string };

export type ScanResult =
  | {
      status: 'allowed';
      guestName: string | null;
      lotCode: string | null;
      // true cuando el ingreso surge de un enrolamiento hecho offline
      // (#27): el server no confirmo en el momento, esta encolado. Se
      // rendera un subtitulo en la pantalla verde para que el guardia
      // sepa que la sincronizacion queda pendiente.
      offlineEnrolled?: boolean;
    }
  | {
      status: 'needs_enrollment';
      invitationId: string;
      token: string;
      // lotCode del server (#98). Offline no lo conoce — cuando la
      // decision surge de validateOffline, viaja como null.
      lotCode: string | null;
      // Nombre del invitado tal como esta en la invitacion (securepassb#173).
      // Se muestra en la pantalla de enrolamiento para que el guardia
      // haga el cruce visual contra el nombre que sale del PDF417 del
      // DNI. Offline es null: el QR no lleva PII. Null tambien si el
      // server no lo emitio (ej. rama WORKER, o server viejo antes de #173).
      guestName: string | null;
    }
  | { status: 'denied'; reason: DenialReason; message: string };

export type DniData = {
  document: string;
  lastName: string;
  firstName: string;
  gender: 'M' | 'F' | null;
  birthDate: string | null;
};
