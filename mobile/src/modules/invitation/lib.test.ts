import { describe, expect, it } from 'vitest';

import { formatWindow, remainingUses } from '@/modules/invitation/lib';

describe('formatWindow', () => {
  it('devuelve Sin ventana si falta algun extremo', () => {
    expect(formatWindow(undefined, undefined)).toBe('Sin ventana');
    expect(formatWindow('2026-08-20T18:00:00Z', undefined)).toBe('Sin ventana');
  });

  it('formatea la ventana completa', () => {
    const window = formatWindow(
      '2026-08-20T18:00:00Z',
      '2026-08-20T23:59:00Z',
    );
    expect(window).toContain('-');
    expect(window).not.toBe('Sin ventana');
  });
});

describe('remainingUses', () => {
  it('calcula usos restantes', () => {
    expect(remainingUses({ maxUses: 5, usedCount: 2 })).toBe(3);
  });

  it('no baja de cero', () => {
    expect(remainingUses({ maxUses: 1, usedCount: 3 })).toBe(0);
  });

  it('devuelve null sin datos de cupo', () => {
    expect(remainingUses({})).toBeNull();
    expect(remainingUses({ maxUses: 2 })).toBeNull();
  });
});
