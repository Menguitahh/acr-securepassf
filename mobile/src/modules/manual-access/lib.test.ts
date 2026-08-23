import { describe, expect, it } from 'vitest';

import { validateManualAccess } from '@/modules/manual-access/lib';
import type { ManualAccessFormValues } from '@/modules/manual-access/types';

const GATE = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const CLIENT = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const LOT = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

function base(overrides: Partial<ManualAccessFormValues> = {}): ManualAccessFormValues {
  return {
    subjectName: 'Juan Perez',
    subjectDocument: '30123456',
    lotCode: 'M4-L12',
    lotId: LOT,
    ...overrides,
  };
}

describe('validateManualAccess', () => {
  it('devuelve payload valido cuando todos los datos estan', () => {
    const result = validateManualAccess(base(), GATE, CLIENT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toMatchObject({
        subjectName: 'Juan Perez',
        subjectDocument: '30123456',
        lotId: LOT,
        gateId: GATE,
        clientEventId: CLIENT,
      });
      expect(result.payload.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('exige garita configurada', () => {
    expect(validateManualAccess(base(), null, CLIENT)).toMatchObject({
      ok: false,
      error: 'Falta la garita configurada en este dispositivo.',
    });
  });

  it('exige nombre no vacio', () => {
    expect(validateManualAccess(base({ subjectName: '  ' }), GATE, CLIENT)).toMatchObject({
      ok: false,
      error: 'Poné el nombre de quien ingresa.',
    });
  });

  it('exige DNI de 7 u 8 digitos y rechaza letras', () => {
    expect(validateManualAccess(base({ subjectDocument: '' }), GATE, CLIENT)).toMatchObject({
      ok: false,
      error: 'Poné el DNI de quien ingresa.',
    });
    expect(validateManualAccess(base({ subjectDocument: '123456' }), GATE, CLIENT)).toMatchObject({
      ok: false,
      error: 'El DNI va de 7 a 8 digitos.',
    });
    expect(validateManualAccess(base({ subjectDocument: 'abc12345' }), GATE, CLIENT)).toMatchObject({
      ok: false,
    });
  });

  it('normaliza puntos, espacios y guiones del DNI antes de enviar', () => {
    for (const raw of ['30.123.456', '30 123 456', '30-123-456']) {
      const result = validateManualAccess(base({ subjectDocument: raw }), GATE, CLIENT);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.payload.subjectDocument).toBe('30123456');
    }
  });

  it('exige lote elegido del listado (lotCode tipeado sin lotId no vale)', () => {
    expect(
      validateManualAccess(base({ lotCode: 'M4-L12', lotId: null }), GATE, CLIENT),
    ).toMatchObject({ ok: false, error: 'Elegí un lote del listado.' });
  });
});
