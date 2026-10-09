import { queryClient } from '@/common/query/client';
import { clearSession } from '@/modules/auth/session-storage';
import { useSessionStore } from '@/modules/auth/session-store';
import type { SignOutReason } from '@/modules/auth/types';

// Unico camino de salida cuando el server rechaza la sesion: tokens, cache
// de queries y store. Los layouts reaccionan al signedOut y mandan al login.
//
// NO toca SQLite: el outbox y los caches son de la garita, no del guardia
// (#122). Una sesion vencida no puede costar eventos sin sincronizar.
export async function endSession(reason: SignOutReason): Promise<void> {
  try {
    await clearSession();
  } catch {
    // Storage roto: igual se corta en memoria. El proximo boot no encuentra
    // sesion valida y sale al login.
  }
  queryClient.clear();
  useSessionStore.getState().signOut(reason);
}
