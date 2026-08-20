import { api, authRequest } from '@/common/api/client';
import { getDb } from '@/common/db/database';

// Sincroniza las claves publicas y los jti revocados que la validacion
// offline necesita (spec 8.2). Se corre con red; si la red no esta,
// se conserva la cache anterior y el escaneo offline sigue funcionando
// con lo ultimo que se pudo bajar.
export async function syncAccessCache(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  try {
    const { data, error } = await authRequest(() => api.GET('/api/v1/access/keys'));
    if (!error && data) {
      for (const key of data) {
        if (!key.kid || !key.publicKey) continue;
        db.runSync(
          'INSERT OR REPLACE INTO signing_keys_cache (kid, public_key, fetched_at) VALUES (?, ?, ?)',
          [key.kid, key.publicKey, now],
        );
      }
    }
  } catch {
    // Sin red: la cache anterior sigue valiendo.
  }

  try {
    const last = db.getFirstSync<{ synced_at: string | null }>(
      'SELECT MAX(synced_at) AS synced_at FROM revoked_cache',
    );
    const since = last?.synced_at ?? new Date(0).toISOString();
    const { data, error } = await authRequest(() =>
      api.GET('/api/v1/access/revoked', { params: { query: { since } } }),
    );
    if (!error && data) {
      for (const token of data) {
        if (!token.jti) continue;
        db.runSync('INSERT OR IGNORE INTO revoked_cache (jti, synced_at) VALUES (?, ?)', [
          token.jti,
          now,
        ]);
      }
    }
  } catch {
    // Sin red: la cache anterior sigue valiendo.
  }
}
