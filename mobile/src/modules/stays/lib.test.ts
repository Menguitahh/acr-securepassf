import { describe, expect, it } from 'vitest';

import { NEAR_EXPIRY_MINUTES, WARNING_LEAD_MINUTES } from '@/modules/stays/data';
import {
  parseStoredStays,
  computeWarningSchedule,
  formatRemaining,
  isNearExpiry,
  isWarningDue,
  sortByEnteredAtDesc,
} from '@/modules/stays/lib';
import type { Stay } from '@/modules/stays/types';

function stay(overrides: Stay = {}): Stay {
  return {
    id: 'a',
    subjectName: 'Juan',
    lotCode: 'M4-L12',
    enteredAt: '2026-08-22T10:00:00Z',
    expectedUntil: '2026-08-22T18:00:00Z',
    minutesRemaining: 240,
    warned: false,
    ...overrides,
  };
}

describe('sortByEnteredAtDesc', () => {
  it('deja el ingreso mas reciente arriba', () => {
    const older = stay({ id: 'older', enteredAt: '2026-08-22T08:00:00Z' });
    const newer = stay({ id: 'newer', enteredAt: '2026-08-22T11:00:00Z' });
    const middle = stay({ id: 'middle', enteredAt: '2026-08-22T09:30:00Z' });
    const sorted = sortByEnteredAtDesc([older, newer, middle]);
    expect(sorted.map((s) => s.id)).toEqual(['newer', 'middle', 'older']);
  });

  it('empuja los que no tienen enteredAt al final', () => {
    const first = stay({ id: 'first', enteredAt: '2026-08-22T10:00:00Z' });
    const base = stay({ id: 'orphan' });
    delete base.enteredAt;
    expect(sortByEnteredAtDesc([base, first]).map((s) => s.id)).toEqual(['first', 'orphan']);
  });

  it('no muta la lista original', () => {
    const list = [stay({ id: 'a', enteredAt: '2026-08-22T08:00:00Z' }), stay({ id: 'b', enteredAt: '2026-08-22T10:00:00Z' })];
    const snapshot = list.map((s) => s.id);
    sortByEnteredAtDesc(list);
    expect(list.map((s) => s.id)).toEqual(snapshot);
  });
});

describe('isNearExpiry', () => {
  it('resalta si el server ya marco warned', () => {
    expect(isNearExpiry(stay({ warned: true, minutesRemaining: 500 }))).toBe(true);
  });

  it('resalta si faltan menos que el umbral', () => {
    expect(isNearExpiry(stay({ warned: false, minutesRemaining: NEAR_EXPIRY_MINUTES }))).toBe(true);
    expect(isNearExpiry(stay({ warned: false, minutesRemaining: NEAR_EXPIRY_MINUTES - 1 }))).toBe(true);
    expect(isNearExpiry(stay({ warned: false, minutesRemaining: NEAR_EXPIRY_MINUTES + 1 }))).toBe(false);
  });

  it('no resalta si no hay dato de tiempo restante', () => {
    const s = stay({ warned: false });
    delete s.minutesRemaining;
    expect(isNearExpiry(s)).toBe(false);
  });
});

describe('computeWarningSchedule', () => {
  const NOW = Date.parse('2026-08-22T15:00:00Z');
  const inMinutes = (mins: number): string => new Date(NOW + mins * 60_000).toISOString();
  const at = (mins: number): number => NOW + mins * 60_000;

  describe('sin aviso local', () => {
    it('programa el aviso a expected_until - lead cuando el momento esta en el futuro', () => {
      const s = stay({ expectedUntil: inMinutes(WARNING_LEAD_MINUTES + 30) });
      expect(computeWarningSchedule(s, NOW, undefined)).toEqual({ action: 'schedule', fireAt: at(30) });
    });

    it('dispara ya si el momento del aviso ya paso pero la estadia sigue en ventana razonable', () => {
      const s = stay({ expectedUntil: inMinutes(5) });
      expect(computeWarningSchedule(s, NOW, undefined)).toEqual({ action: 'fireNow' });
    });

    it('salta si otro dispositivo ya aviso (server.warned)', () => {
      const s = stay({ warned: true, expectedUntil: inMinutes(30) });
      expect(computeWarningSchedule(s, NOW, undefined)).toEqual({ action: 'skip', reason: 'already-warned' });
    });

    it('salta si expected_until ya paso hace demasiado (permanencia excedida, no aviso)', () => {
      const s = stay({ expectedUntil: inMinutes(-(WARNING_LEAD_MINUTES + 5)) });
      expect(computeWarningSchedule(s, NOW, undefined)).toEqual({ action: 'skip', reason: 'already-past' });
    });

    it('salta si no hay expected_until', () => {
      const s = stay();
      delete s.expectedUntil;
      expect(computeWarningSchedule(s, NOW, undefined)).toEqual({ action: 'skip', reason: 'no-expected-until' });
    });
  });

  describe('con aviso local (#31: warned en el server recien al vencer)', () => {
    it('programado para mas adelante: no avisa al server todavia', () => {
      const s = stay({ warned: false, expectedUntil: inMinutes(300) });
      expect(computeWarningSchedule(s, NOW, { fireAt: at(280), synced: false })).toEqual({
        action: 'skip',
        reason: 'scheduled',
      });
    });

    it('vencido y el server no lo sabe: markWarned', () => {
      const s = stay({ warned: false, expectedUntil: inMinutes(10) });
      expect(computeWarningSchedule(s, NOW, { fireAt: at(-10), synced: false })).toEqual({ action: 'markWarned' });
    });

    it('vencido, lo mande pero el server lo perdio: reintenta markWarned', () => {
      const s = stay({ warned: false, expectedUntil: inMinutes(10) });
      expect(computeWarningSchedule(s, NOW, { fireAt: at(-10), synced: true })).toEqual({ action: 'markWarned' });
    });

    it('pendiente y otro dispositivo aviso primero: cancel', () => {
      const s = stay({ warned: true, expectedUntil: inMinutes(60) });
      expect(computeWarningSchedule(s, NOW, { fireAt: at(40), synced: false })).toEqual({ action: 'cancel' });
    });

    it('vencido y el server ya lo tiene: skip', () => {
      const s = stay({ warned: true, expectedUntil: inMinutes(10) });
      expect(computeWarningSchedule(s, NOW, { fireAt: at(-10), synced: true })).toEqual({
        action: 'skip',
        reason: 'already-warned',
      });
    });

    it('fila vieja sin fire_at: lo deriva de expected_until', () => {
      const s = stay({ warned: false, expectedUntil: inMinutes(300) });
      expect(computeWarningSchedule(s, NOW, { fireAt: null, synced: false })).toEqual({
        action: 'skip',
        reason: 'scheduled',
      });
    });
  });
});

describe('isWarningDue', () => {
  const NOW = Date.parse('2026-08-22T15:00:00Z');
  it('un aviso programado para dentro de horas no resalta la fila', () => {
    const s = stay({ expectedUntil: new Date(NOW + 300 * 60_000).toISOString() });
    expect(isWarningDue(s, { fireAt: NOW + 280 * 60_000, synced: false }, NOW)).toBe(false);
    expect(isWarningDue(s, { fireAt: NOW - 1, synced: false }, NOW)).toBe(true);
    expect(isWarningDue(s, undefined, NOW)).toBe(false);
  });
});

describe('formatRemaining', () => {
  it('horas y minutos, o vencido', () => {
    expect(formatRemaining(1411)).toBe('Quedan 23 h 31 min');
    expect(formatRemaining(120)).toBe('Quedan 2 h');
    expect(formatRemaining(15)).toBe('Quedan 15 min');
    expect(formatRemaining(0)).toBe('Vencido');
  });
});

describe('parseStoredStays (#208)', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');

  it('nada guardado o forma rara: undefined', () => {
    expect(parseStoredStays(undefined, now)).toBeUndefined();
    expect(parseStoredStays({ stays: [] }, now)).toBeUndefined();
    expect(parseStoredStays([{ subjectName: 'Sin id' }], now)).toBeUndefined();
  });

  it('recalcula minutesRemaining con expectedUntil', () => {
    const stored = [{ id: 's1', subjectName: 'Ana', expectedUntil: '2026-10-09T12:30:00Z', minutesRemaining: 300, otro: 1 }];
    expect(parseStoredStays(stored, now)).toEqual([
      { id: 's1', subjectName: 'Ana', expectedUntil: '2026-10-09T12:30:00Z', minutesRemaining: 30 },
    ]);
  });

  it('sin expectedUntil no inventa minutos', () => {
    expect(parseStoredStays([{ id: 's2', warned: true, minutesRemaining: 5 }], now)).toEqual([{ id: 's2', warned: true }]);
  });
});
