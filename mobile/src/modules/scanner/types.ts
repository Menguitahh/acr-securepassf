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
  | 'WORKER_NOT_SYNCED'
  | 'UNKNOWN';

export type OfflineDenialReason =
  | 'INVALID_SIGNATURE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'REVOKED'
  | 'OUT_OF_SCHEDULE'
  | 'NEIGHBORHOOD_TZ_MISSING'
  | 'WORKER_NOT_SYNCED'
  | 'UNKNOWN';

export type InvitationPayload = {
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
  st?: never;
};

// Token del trabajador (subType W, WBS-116): ligado al usuario, sin
// invitacion, lote, ventana ni cupo. El permiso vive en el cache de
// permisos (WBS-118).
export type WorkerPayload = {
  v: number;
  k: string;
  j: string;
  n: string;
  st: 'W';
  s: string;
};

export type TokenPayload = InvitationPayload | WorkerPayload;

// Permiso WORKER cacheado desde /access/permissions/sync. La franja se
// evalua con la tz de la fila: franja y zona viajan juntas (spec WBS-118).
export type WorkerPermission = {
  jti: string;
  lotCode: string;
  weekdays: number[];
  dailyFrom: string;
  dailyUntil: string;
  timezone: string | null;
};

// Quien se enrola: el invitado se identifica por su invitacion, el
// trabajador por su usuario.
export type EnrollmentSubject =
  | { kind: 'guest'; invitationId: string }
  | { kind: 'worker'; userId: string };

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
  workerPermissions: (userId: string) => WorkerPermission[];
  isWorkerEnrolled: (userId: string) => boolean;
};

export type AccessDecision =
  | { status: 'allowed' }
  | { status: 'allowed_worker'; lotCodes: string[] }
  | { status: 'needs_enrollment'; subject: EnrollmentSubject }
  | { status: 'denied'; reason: DenialReason; message: string };

export type OfflineScan = { clientEventId: string; capturedAt: string };

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
      subject: EnrollmentSubject;
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
      // Datos del escaneo cuando lo decidio la garita sin red. Si el
      // guardia cancela el DNI, el rechazo NOT_ENROLLED viaja con ellos.
      // Null si lo decidio el server: ese escaneo ya quedo registrado alla.
      offlineScan: OfflineScan | null;
    }
  | { status: 'denied'; reason: DenialReason; message: string };

export type DniData = {
  document: string;
  lastName: string;
  firstName: string;
  gender: 'M' | 'F' | null;
  birthDate: string | null;
};
