import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from '@/common/db/migrations';

export const DB_NAME = 'securepass.db';

let database: SQLite.SQLiteDatabase | null = null;

function migrate(db: SQLite.SQLiteDatabase): void {
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= MIGRATIONS.length) return;

  db.withTransactionSync(() => {
    for (let version = current; version < MIGRATIONS.length; version++) {
      db.execSync(MIGRATIONS[version] ?? '');
      db.execSync(`PRAGMA user_version = ${version + 1}`);
    }
  });
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync(DB_NAME);
    migrate(database);
  }
  return database;
}

export function wipeLocalDatabase(): void {
  if (database) {
    database.closeSync();
    database = null;
  }
  SQLite.deleteDatabaseSync(DB_NAME);
}
