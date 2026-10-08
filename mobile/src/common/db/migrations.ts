// Migraciones locales versionadas. Una entrada por version; el indice + 1
// es el valor de PRAGMA user_version tras aplicarla. Esquema de spec.md 8.1.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE consumed_tokens (
    jti          TEXT NOT NULL,
    use_seq      INTEGER NOT NULL,
    captured_at  TEXT NOT NULL,
    PRIMARY KEY (jti, use_seq)
  );

  CREATE TABLE outbox (
    client_event_id TEXT PRIMARY KEY,
    payload         TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT
  );

  CREATE TABLE signing_keys_cache (
    kid         TEXT PRIMARY KEY,
    public_key  TEXT NOT NULL,
    fetched_at  TEXT NOT NULL
  );

  CREATE TABLE revoked_cache (
    jti         TEXT PRIMARY KEY,
    synced_at   TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE enrollments_cache (
    invitation_id TEXT PRIMARY KEY,
    document      TEXT NOT NULL,
    enrolled_at   TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE stay_warnings (
    stay_id      TEXT PRIMARY KEY,
    warned_at    TEXT NOT NULL,
    notification_id TEXT
  );
  `,
  // #166: el cursor de revocaciones sale del revokedAt del server, no de
  // la hora del telefono. Las filas viejas quedan en NULL y el proximo
  // sync las vuelve a pedir desde cero para completarlo.
  `
  ALTER TABLE revoked_cache ADD COLUMN revoked_at TEXT;
  `,
  // WBS-118: permisos WORKER y trabajadores enrolados para validar sin red.
  // Se reemplazan completos en cada sync (worker-cache.ts).
  `
  CREATE TABLE worker_permissions_cache (
    user_id      TEXT NOT NULL,
    jti          TEXT NOT NULL,
    lot_id       TEXT NOT NULL,
    lot_code     TEXT NOT NULL,
    weekdays     TEXT NOT NULL,
    daily_from   TEXT NOT NULL,
    daily_until  TEXT NOT NULL,
    timezone     TEXT,
    PRIMARY KEY (user_id, lot_id)
  );

  CREATE TABLE worker_enrollments_cache (
    user_id TEXT PRIMARY KEY
  );
  `,
];
