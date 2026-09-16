import { describe, expect, it } from 'vitest';

import { isValidEmail } from '@/modules/family/email';

describe('isValidEmail', () => {
  it('acepta formatos comunes', () => {
    expect(isValidEmail('luciano@gmail.com')).toBe(true);
    expect(isValidEmail('nombre.apellido+tag@dominio.com.ar')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
  });

  it('rechaza basura estructural', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('sin-arroba.com')).toBe(false);
    expect(isValidEmail('sin-tld@dominio')).toBe(false);
    expect(isValidEmail('tld-corto@dominio.c')).toBe(false);
    expect(isValidEmail('con espacio@dominio.com')).toBe(false);
    expect(isValidEmail('local@ dominio.com')).toBe(false);
    expect(isValidEmail('doble@@arroba.com')).toBe(false);
  });

  // Limite conocido del sanity check: los typos de TLD real-looking pasan.
  // Documentado para que quede explicito que el issue #95 no cierra este
  // caso — hace falta feedback de bounce del mailer (issue backend
  // separado). Si alguien "arregla" este test, esta desconociendo la
  // decision.
  it('ACEPTA typos de TLD plausibles como .copm (limite conocido)', () => {
    expect(isValidEmail('luciano@dsad.copm')).toBe(true);
    expect(isValidEmail('nombre@gmial.com')).toBe(true);
    expect(isValidEmail('foo@dominio.con')).toBe(true);
  });
});
