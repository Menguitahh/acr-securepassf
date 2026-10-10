import { describe, expect, it } from 'vitest';

import { qrSize } from '@/common/lib/qr';

describe('qrSize (#233)', () => {
  it('entra con margen y zona de silencio en 320 dp, y no pasa de 280', () => {
    expect(qrSize(320)).toBe(224);
    expect(qrSize(375)).toBe(279);
    expect(qrSize(768)).toBe(280);
    expect(qrSize(200)).toBe(200);
  });
});
