import { api } from '@/common/api/client';
import { readLastKnown, rememberLastKnown } from '@/common/query/last-known';
import { parseManualQueue } from '@/modules/offline/lib';
import type { ManualAccessRequest } from '@/modules/manual-access/types';

// WBS-36: ingresos manuales registrados sin red. Se guardan por guardia y se
// reenvian al volver la red con el mismo clientEventId: POST /access/manual es
// idempotente, un reenvio no duplica.
const KEY = 'manual.pending';

export function pendingManual(): ManualAccessRequest[] {
  return parseManualQueue(readLastKnown(KEY));
}

export function enqueueManual(request: ManualAccessRequest): void {
  rememberLastKnown(KEY, [...pendingManual(), request]);
}

// Manda en orden. Sin red, corta y queda todo para el proximo intento. Un
// 409 (sin turno abierto) tambien queda: el guardia puede abrir turno. Un
// rechazo definitivo (400/404: lote que ya no existe, datos invalidos) sale
// de la cola y queda en el log: no se reintenta para siempre.
export async function flushManualQueue(): Promise<'empty' | 'synced' | 'error'> {
  const queue = pendingManual();
  if (!queue.length) return 'empty';
  const remaining: ManualAccessRequest[] = [];
  let failed = false;
  for (const [index, request] of queue.entries()) {
    try {
      const { response } = await api.POST('/api/v1/access/manual', { body: request });
      if (response.ok) continue;
      if (response.status === 409 || response.status >= 500) {
        remaining.push(request);
        failed = true;
      } else {
        console.warn('manual-queue: ingreso rechazado', response.status, request.clientEventId);
      }
    } catch {
      remaining.push(...queue.slice(index));
      failed = true;
      break;
    }
  }
  rememberLastKnown(KEY, remaining);
  return failed ? 'error' : 'synced';
}
