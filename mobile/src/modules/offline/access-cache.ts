import { api } from '@/common/api/client';
import { getDb } from '@/common/db/database';

// Sincroniza las claves publicas y los jti revocados que la validacion
// offline necesita (spec 8.2). Se corre con red; si la red no esta,
// se conserva la cache anterior y el escaneo offline sigue funcionando
// con lo ultimo que se pudo bajar.
export async function syncAccessCache(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  try {
    const { data, error } = await api.GET('/api/v1/access/keys');
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
    // El cursor es el mayor revokedAt del server, no la hora del telefono
    // (#166): con el reloj adelantado o con mas revocaciones que el corte
    // del server, la hora local saltea filas para siempre. Se guarda en
    // ISO de toISOString para que MAX compare bien como texto.
    const last = db.getFirstSync<{ revoked_at: string | null }>(
      'SELECT MAX(revoked_at) AS revoked_at FROM revoked_cache',
    );
    let cursor = last?.revoked_at ? Date.parse(last.revoked_at) : 0;
    // El server filtra revoked_at > since, ordena ascendente y corta la
    // pagina. Pedir desde 1 ms antes del cursor vuelve a traer los empates
    // del borde, asi una pagina cortada en medio de un empate no pierde
    // filas. Se repite mientras la pagina traiga algo que no estaba.
    // ponytail: si mas de una pagina entera cae en el mismo ms, el resto
    // del empate no se alcanza; sumar paginado por jti en el server si pasa.
    for (;;) {
      const since = new Date(Math.max(cursor - 1, 0)).toISOString();
      const { data, error } = await api.GET('/api/v1/access/revoked', { params: { query: { since } } });
      if (error || !data) return;
      let added = 0;
      db.withTransactionSync(() => {
        for (const token of data) {
          if (!token.jti) continue;
          const parsed = token.revokedAt ? Date.parse(token.revokedAt) : NaN;
          const revokedAt = Number.isNaN(parsed) ? null : parsed;
          if (revokedAt !== null && revokedAt > cursor) cursor = revokedAt;
          // Inserta la nueva o completa el revoked_at de una fila previa a
          // la migracion; changes = 0 si ya estaba completa.
          added += db.runSync(
            `INSERT INTO revoked_cache (jti, synced_at, revoked_at) VALUES (?, ?, ?)
             ON CONFLICT(jti) DO UPDATE SET revoked_at = excluded.revoked_at
             WHERE revoked_at IS NULL AND excluded.revoked_at IS NOT NULL`,
            [token.jti, now, revokedAt === null ? null : new Date(revokedAt).toISOString()],
          ).changes;
        }
      });
      if (added === 0) return;
    }
  } catch {
    // Sin red: la cache anterior sigue valiendo.
  }
}
