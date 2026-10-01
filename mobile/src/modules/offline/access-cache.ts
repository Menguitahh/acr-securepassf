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
    const keys =
      !error && data
        ? data.flatMap(({ kid, publicKey }) => (kid && publicKey ? [{ kid, publicKey }] : []))
        : [];
    // El server manda solo las claves activas del barrio del guardia. Se
    // reemplaza el set entero: una clave desactivada o de otro barrio no
    // puede seguir validando offline (#165). Sin claves usables no se
    // toca: un cache vacio deniega todo escaneo offline. El cambio de
    // barrio antes del primer sync lo cierra el wipe del login (#121).
    if (keys.length > 0) {
      db.withTransactionSync(() => {
        db.runSync('DELETE FROM signing_keys_cache');
        for (const key of keys) {
          db.runSync(
            'INSERT INTO signing_keys_cache (kid, public_key, fetched_at) VALUES (?, ?, ?)',
            [key.kid, key.publicKey, now],
          );
        }
      });
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
