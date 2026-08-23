import { describe, expect, it } from 'vitest';

import { elapsedMinutes, formatElapsed, isOpenShift } from '@/modules/shifts/lib';
import type { Shift } from '@/modules/shifts/types';

describe('isOpenShift', () => {
  it('acepta shift con id y sin endedAt', () => {
    const shift: Shift = { id: 'abc', startedAt: '2026-08-22T10:00:00Z' };
    expect(isOpenShift(shift)).toBe(true);
  });

  it('rechaza null, undefined, sin id o con endedAt', () => {
    expect(isOpenShift(null)).toBe(false);
    expect(isOpenShift(undefined)).toBe(false);
    expect(isOpenShift({} as Shift)).toBe(false);
    expect(isOpenShift({ id: 'abc', endedAt: '2026-08-22T18:00:00Z' })).toBe(false);
  });
});

describe('elapsedMinutes', () => {
  const NOW = Date.parse('2026-08-22T12:00:00Z');

  it('devuelve minutos redondeados hacia abajo', () => {
    expect(elapsedMinutes('2026-08-22T11:00:00Z', NOW)).toBe(60);
    expect(elapsedMinutes('2026-08-22T11:59:59Z', NOW)).toBe(0);
    expect(elapsedMinutes('2026-08-22T10:30:00Z', NOW)).toBe(90);
  });

  it('devuelve 0 si el startedAt esta en el futuro (clock skew)', () => {
    expect(elapsedMinutes('2026-08-22T13:00:00Z', NOW)).toBe(0);
  });

  it('devuelve null si no hay startedAt o es invalido', () => {
    expect(elapsedMinutes(undefined, NOW)).toBeNull();
    expect(elapsedMinutes('no-una-fecha', NOW)).toBeNull();
  });
});

describe('formatElapsed', () => {
  it('menos de una hora: solo minutos', () => {
    expect(formatElapsed(0)).toBe('0m');
    expect(formatElapsed(45)).toBe('45m');
  });

  it('horas exactas: sin minutos', () => {
    expect(formatElapsed(60)).toBe('1h');
    expect(formatElapsed(180)).toBe('3h');
  });

  it('horas + minutos', () => {
    expect(formatElapsed(75)).toBe('1h 15m');
    expect(formatElapsed(192)).toBe('3h 12m');
  });
});
