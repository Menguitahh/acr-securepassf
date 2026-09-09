import { describe, expect, it } from 'vitest';

import { NEAR_EXPIRY_MINUTES, WARNING_LEAD_MINUTES } from '@/modules/stays/data';
import {
  computeWarningSchedule,
  isNearExpiry,
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

  describe('sin local ni server (device fresco, stay activo)', () => {
    it('programa el aviso a expected_until - lead cuando el momento esta en el futuro', () => {
      const s = stay({ expectedUntil: inMinutes(WARNING_LEAD_MINUTES + 30) });
      const result = computeWarningSchedule(s, NOW, false, false);
      expect(result).toEqual({ action: 'schedule', fireAt: NOW + 30 * 60_000 });
    });

    it('dispara ya si el momento del aviso ya paso pero la estadia sigue en ventana razonable', () => {
      const s = stay({ expectedUntil: inMinutes(5) });
      expect(computeWarningSchedule(s, NOW, false, false)).toEqual({ action: 'fireNow' });
    });

    it('salta si expected_until ya paso hace demasiado (permanencia excedida, no aviso)', () => {
      const s = stay({ expectedUntil: inMinutes(-(WARNING_LEAD_MINUTES + 5)) });
      expect(computeWarningSchedule(s, NOW, false, false)).toEqual({
        action: 'skip',
        reason: 'already-past',
      });
    });

    it('salta si no hay expected_until', () => {
      const s = stay();
      delete s.expectedUntil;
      expect(computeWarningSchedule(s, NOW, false, false)).toEqual({
        action: 'skip',
        reason: 'no-expected-until',
      });
    });

    it('salta si ya fue marcada warned por el server (device fresco unido despues del aviso)', () => {
      const s = stay({ warned: true, expectedUntil: inMinutes(30) });
      expect(computeWarningSchedule(s, NOW, false, false)).toEqual({
        action: 'skip',
        reason: 'already-warned',
      });
    });
  });

  describe('tabla de decisiones cross-device (#31 mark-warned)', () => {
    // Yo soy dueño del aviso (locallySynced=true) Y el server lo confirma:
    // no cancelar mi propia notif, es la que va a avisar al guardia.
    it('locallyWarned + locallySynced + server.warned=true → skip (yo dueño)', () => {
      const s = stay({ warned: true, expectedUntil: inMinutes(30) });
      expect(computeWarningSchedule(s, NOW, true, true)).toEqual({
        action: 'skip',
        reason: 'already-warned',
      });
    });

    // Yo digo que sincronice pero el server dice que no. Divergencia real:
    // O el server perdio el mark, O mi flag miente. Retry con warn.
    it('locallyWarned + locallySynced + server.warned=false → markWarned (divergente)', () => {
      const s = stay({ warned: false, expectedUntil: inMinutes(30) });
      expect(computeWarningSchedule(s, NOW, true, true)).toEqual({
        action: 'markWarned',
        divergent: true,
      });
    });

    // Otro device fue dueño: mi notif local pendiente sale del outbox
    // antes que dispare, para no duplicar.
    it('locallyWarned + NO synced + server.warned=true → cancel (otro fue dueño)', () => {
      const s = stay({ warned: true, expectedUntil: inMinutes(30) });
      expect(computeWarningSchedule(s, NOW, true, false)).toEqual({ action: 'cancel' });
    });

    // Yo programe pero mi POST no llego. Retry limpio.
    it('locallyWarned + NO synced + server.warned=false → markWarned (retry)', () => {
      const s = stay({ warned: false, expectedUntil: inMinutes(30) });
      expect(computeWarningSchedule(s, NOW, true, false)).toEqual({
        action: 'markWarned',
        divergent: false,
      });
    });
  });
});
