import { describe, expect, it } from 'vitest';

import { exitAlreadyRequested, pendingResidentStays } from '@/modules/resident-stays/lib';
import type { Stay } from '@/modules/stays/types';

function stay(overrides: Stay = {}): Stay {
  return {
    id: 'stay-1',
    invitationId: 'inv-1',
    subjectName: 'Juan',
    lotCode: 'M4-L12',
    warned: true,
    ...overrides,
  };
}

describe('pendingResidentStays', () => {
  it('deja solo warned=true con invitationId', () => {
    const orphan = stay({ id: 'c' });
    delete orphan.invitationId;
    const list: Stay[] = [
      stay({ id: 'a' }),
      stay({ id: 'b', warned: false }),
      orphan,
      stay({ id: 'd' }),
    ];
    expect(pendingResidentStays(list).map((s) => s.id)).toEqual(['a', 'd']);
  });

  it('excluye MANUAL (invitationId ausente) aunque este warned', () => {
    const manual = stay({ id: 'manual' });
    delete manual.invitationId;
    const list: Stay[] = [stay({ id: 'a' }), manual];
    expect(pendingResidentStays(list).map((s) => s.id)).toEqual(['a']);
  });

  it('devuelve vacio si la lista esta vacia', () => {
    expect(pendingResidentStays([])).toEqual([]);
  });
});

describe('exitAlreadyRequested', () => {
  it('es true si exitRequestedAt esta seteado', () => {
    expect(exitAlreadyRequested(stay({ exitRequestedAt: '2026-08-22T18:00:00Z' }))).toBe(true);
  });

  it('es false si no vino o esta vacio', () => {
    expect(exitAlreadyRequested(stay())).toBe(false);
    expect(exitAlreadyRequested(stay({ exitRequestedAt: '' }))).toBe(false);
  });
});

describe('pendingResidentStays tras extender', () => {
  it('saca la estadia extendida mas alla del umbral y deja la que sigue por vencer', () => {
    const list: Stay[] = [stay({ id: 'extendida', minutesRemaining: 130 }), stay({ id: 'por-vencer', minutesRemaining: 10 })];
    expect(pendingResidentStays(list).map((s) => s.id)).toEqual(['por-vencer']);
  });
});
