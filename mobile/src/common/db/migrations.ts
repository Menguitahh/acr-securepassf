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
  // #31 mark-warned: distinguir "yo fui dueño del aviso" (mark_warned_synced=1)
  // de "otro device fue dueño" (mark_warned_synced=0 + server.warned=true).
  // Sin este flag, un solo device de garita cancela su propia notif
  // pendiente en cuanto su POST llega y el server la marca warned=true.
  `
  ALTER TABLE stay_warnings ADD COLUMN mark_warned_synced INTEGER NOT NULL DEFAULT 0;
  `,
];
