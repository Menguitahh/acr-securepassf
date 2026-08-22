import { describe, expect, it } from 'vitest';

import { NEAR_EXPIRY_MINUTES } from '@/modules/stays/data';
import { isNearExpiry, sortByEnteredAtDesc } from '@/modules/stays/lib';
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
