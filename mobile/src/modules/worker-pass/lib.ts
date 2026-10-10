import type { WorkerQr } from '@/modules/worker-pass/types';

// Lo guardado puede venir de otra version de la app: se valida.
export function parseStoredWorkerQr(value: unknown): WorkerQr | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object' || !('token' in value) || typeof value.token !== 'string') return undefined;
  return value.token.length > 0 ? { token: value.token } : undefined;
}
