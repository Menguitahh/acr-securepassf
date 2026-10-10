import { describe, expect, it } from 'vitest';

import { parseStoredWorkerQr } from '@/modules/worker-pass/lib';

describe('parseStoredWorkerQr (US-65)', () => {
  it('QR guardado, sin permisos o nada guardado', () => {
    expect(parseStoredWorkerQr({ token: 'SP1.x', otro: 1 })).toEqual({ token: 'SP1.x' });
    expect(parseStoredWorkerQr(null)).toBeNull();
    expect(parseStoredWorkerQr(undefined)).toBeUndefined();
    expect(parseStoredWorkerQr({ token: '' })).toBeUndefined();
    expect(parseStoredWorkerQr('roto')).toBeUndefined();
  });
});
