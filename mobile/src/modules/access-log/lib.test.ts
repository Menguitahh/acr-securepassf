import { describe, expect, it } from 'vitest';

import { describeAccessLog, formatLogTime, shiftLogSummary } from '@/modules/access-log/lib';

describe('describeAccessLog (US-72 / #214)', () => {
  it('permitido: nombre, direccion y lote', () => {
    expect(
      describeAccessLog({ result: 'ALLOWED', direction: 'IN', subjectName: 'Ana', lotCode: 'A-1' }),
    ).toEqual({ title: 'Ana', detail: 'Ingreso · Lote A-1', outcome: 'Entró', denied: false });
    expect(describeAccessLog({ result: 'ALLOWED', direction: 'OUT', subjectName: 'Ana' }).outcome).toBe('Salió');
  });

  it('denegado: nombra el pase, no a la persona, y dice el motivo', () => {
    expect(
      describeAccessLog({ result: 'DENIED', direction: 'IN', denialReason: 'EXPIRED', passHolderName: 'Ana' }),
    ).toEqual({
      title: 'Se presentó el pase de Ana',
      detail: 'Ingreso',
      outcome: 'Denegado: Pase vencido',
      denied: true,
    });
  });

  it('denegado sin pase ni motivo conocido no rompe', () => {
    expect(
      describeAccessLog({ result: 'DENIED', subjectType: 'SERVICE', subjectName: 'Ramón Díaz', denialReason: 'OUT_OF_SCHEDULE' }).title,
    ).toBe('Se presentó el QR de trabajo de Ramón Díaz');
    expect(describeAccessLog({ result: 'DENIED', subjectType: 'SERVICE' }).title).toBe('Se presentó un QR de trabajo');
    const row = describeAccessLog({ result: 'DENIED', denialReason: 'NUEVO_MOTIVO' });
    expect(row.title).toBe('Se presentó un QR sin pase asociado');
    expect(row.outcome).toBe('Denegado: Motivo desconocido');
  });
});

describe('formatLogTime', () => {
  const now = new Date(2026, 9, 9, 18, 0);

  it('hoy solo la hora; otro dia con fecha', () => {
    expect(formatLogTime(new Date(2026, 9, 9, 14, 5).toISOString(), now)).toMatch(/(14|02):05/);
    expect(formatLogTime(new Date(2026, 9, 7, 9, 0).toISOString(), now)).toMatch(/^7\/10 /);
    expect(formatLogTime(undefined, now)).toBe('');
  });
});

describe('shiftLogSummary', () => {
  it('cuenta ingresos y egresos permitidos y los denegados', () => {
    expect(
      shiftLogSummary([
        { result: 'ALLOWED', direction: 'IN' },
        { result: 'ALLOWED', direction: 'IN' },
        { result: 'ALLOWED', direction: 'OUT' },
        { result: 'DENIED', direction: 'IN' },
      ]),
    ).toBe('2 ingresos · 1 egreso · 1 denegado');
    expect(shiftLogSummary([{ result: 'ALLOWED', direction: 'IN' }])).toBe('1 ingreso · 0 egresos');
  });
});
