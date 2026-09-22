import { describe, expect, it } from 'vitest';

import {
  elapsedMinutes,
  formatElapsed,
  isOpenShift,
  parseCurrentShift,
  pickCloseDialog,
} from '@/modules/shifts/lib';
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

describe('pickCloseDialog', () => {
  it('count > 0: advierte con conteo (tres opciones en la vista)', () => {
    expect(pickCloseDialog({ isLoading: false, isError: false, count: 4 })).toEqual({
      kind: 'confirm-with-open',
      count: 4,
    });
  });

  it('count === 0: confirmacion generica', () => {
    expect(pickCloseDialog({ isLoading: false, isError: false, count: 0 })).toEqual({
      kind: 'confirm-empty',
    });
  });

  it('isError: deja cerrar con aviso (guardia sin red no queda trabado)', () => {
    expect(pickCloseDialog({ isLoading: false, isError: true, count: undefined })).toEqual({
      kind: 'warn-unknown',
    });
  });

  it('isLoading sin cache: disabled (boton dice "Verificando estadias...")', () => {
    expect(pickCloseDialog({ isLoading: true, isError: false, count: undefined })).toEqual({
      kind: 'disabled',
    });
  });

  it('sin loading, sin error, sin count: warn-unknown (no asumir 0)', () => {
    expect(pickCloseDialog({ isLoading: false, isError: false, count: undefined })).toEqual({
      kind: 'warn-unknown',
    });
  });

  it('cache disponible durante refetch (isLoading=true + count definido): usa el count', () => {
    // TanStack Query mantiene data anterior durante refetch. No debe
    // caer a "disabled" cuando ya tenemos un conteo utilizable.
    expect(pickCloseDialog({ isLoading: true, isError: false, count: 2 })).toEqual({
      kind: 'confirm-with-open',
      count: 2,
    });
  });
});

describe('parseCurrentShift', () => {
  const shift: Shift = { id: 'abc', startedAt: '2026-08-22T10:00:00Z' };

  it('204 devuelve null (sin turno abierto es estado valido)', () => {
    expect(parseCurrentShift(204, undefined, undefined)).toBeNull();
  });

  it('200 con data devuelve el shift', () => {
    expect(parseCurrentShift(200, shift, undefined)).toEqual(shift);
  });

  it('error del server tira', () => {
    expect(() => parseCurrentShift(500, undefined, { status: 500 })).toThrow(
      'No se pudo cargar el turno actual.',
    );
  });

  it('200 sin data ni error tira (respuesta rota)', () => {
    expect(() => parseCurrentShift(200, undefined, undefined)).toThrow(
      'No se pudo cargar el turno actual.',
    );
  });
});
