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
];
