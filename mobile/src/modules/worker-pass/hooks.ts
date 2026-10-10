import { useQuery } from '@tanstack/react-query';

import { api } from '@/common/api/client';
import { readLastKnown, rememberLastKnown } from '@/common/query/last-known';
import { parseStoredWorkerQr } from '@/modules/worker-pass/lib';
import type { WorkerQr } from '@/modules/worker-pass/types';

const LAST_QR = 'worker.qr';

// US-65: el trabajador muestra el QR en la garita, muchas veces sin datos.
// Se guarda el ultimo que dio el server (#204) y se muestra aunque no haya red.
export function useWorkerQr() {
  return useQuery({
    queryKey: ['worker-qr'],
    queryFn: async (): Promise<WorkerQr> => {
      const { data, response } = await api.GET('/api/v1/me/worker-qr');
      // 404: ya no tiene permisos vigentes en ningun lote.
      if (response.status === 404) {
        rememberLastKnown(LAST_QR, null);
        return null;
      }
      if (!data?.token) throw new Error('No se pudo cargar tu QR.');
      const qr = { token: data.token };
      rememberLastKnown(LAST_QR, qr);
      return qr;
    },
    initialData: () => parseStoredWorkerQr(readLastKnown(LAST_QR)),
    initialDataUpdatedAt: 0,
    networkMode: 'offlineFirst',
  });
}
