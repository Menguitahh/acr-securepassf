import { describe, expect, it } from 'vitest';

import { typeLabel } from '@/modules/invitation/data';

describe('typeLabel', () => {
  it('SINGLE devuelve "Única"', () => {
    expect(typeLabel('SINGLE')).toBe('Única');
  });

  it('EVENT devuelve "Evento"', () => {
    expect(typeLabel('EVENT')).toBe('Evento');
  });

  it('type desconocido cae al fallback generico, no muestra undefined ni el enum crudo', () => {
    // El caso critico: RECURRING viejo sin migrar del backend, o un tipo
    // nuevo que este cliente no conoce. La UI no debe mostrar undefined ni
    // "RECURRING" al residente — el chip vacio deja al usuario sin saber si
    // es bug o pase roto.
    expect(typeLabel('RECURRING')).toBe('Pase');
    expect(typeLabel('WHATEVER_NEW')).toBe('Pase');
  });

  it('type ausente (undefined o null) cae al fallback', () => {
    expect(typeLabel(undefined)).toBe('Pase');
    expect(typeLabel(null)).toBe('Pase');
  });
});
