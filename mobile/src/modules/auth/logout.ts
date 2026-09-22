// Flujo de cierre de sesion para GUARD: intenta drenar el outbox antes de
// limpiar la sesion local. Extraido como funcion pura + inyeccion de deps
// para testear los tres caminos sin RN Alert ni SQLite reales.
//
// Diseno completo: modules/auth/hooks.ts::useLogout. Contexto: issue del
// bug de logout, donde wipeLocalDatabase() rompia la race con useOutboxSync
// y ademas borraba eventos sin sincronizar. Este modulo NO llama
// wipeLocalDatabase — todas las tablas locales son gate-scoped y persisten
// entre guardias (issue #121 cubre el wipe al cambiar de barrio).

const FLUSH_TIMEOUT_MS = 5_000;

export type FlushDecision = 'retry' | 'proceed' | 'cancel';

export type LogoutOutcome = 'closed' | 'cancelled';

export type LogoutDeps = {
  // Intenta drenar el outbox. Puede terminar con eventos igualmente
  // pending (server no responde, red caida). Debe respetar el timeout
  // interno del caller (se envuelve en Promise.race).
  syncOutbox: () => Promise<unknown>;
  // Cuenta filas en el outbox. Lectura sincrona directa a SQLite.
  countPending: () => number;
  // Alert bloqueante al usuario cuando quedan eventos post-flush.
  // Devuelve la decision del guardia entre las 3 opciones. El caller
  // debe garantizar que la promesa se resuelve (Alert nunca cancela
  // sin decision, pasar cancelable: false).
  promptDecision: (pending: number) => Promise<FlushDecision>;
};

// Race con timeout. syncOutbox no tiene timeout nativo, y una garita con
// server lento no puede quedar bloqueada indefinidamente cerrando sesion.
// Si expira el timeout, seguimos al conteo — si drenamos algo, mejor;
// si no, el prompt informa el count real y el guardia decide.
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<void> {
  await Promise.race([
    promise.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

// Recursivo por diseno: "Reintentar" del prompt vuelve a intentar el
// mismo flujo. La recursion termina cuando el guardia elige 'proceed'
// (cerrar igual) o 'cancel' (abortar logout), o cuando el outbox drena.
export async function resolveOutboxFlush(deps: LogoutDeps): Promise<LogoutOutcome> {
  await withTimeout(deps.syncOutbox(), FLUSH_TIMEOUT_MS);
  const pending = deps.countPending();
  if (pending === 0) return 'closed';

  const decision = await deps.promptDecision(pending);
  if (decision === 'cancel') return 'cancelled';
  if (decision === 'proceed') return 'closed';
  return resolveOutboxFlush(deps);
}
