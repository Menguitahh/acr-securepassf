import { describe, expect, it } from 'vitest';

import {
  fromHHmm,
  toHHmm,
  validateWorkerForm,
  validateWorkerSchedule,
  type WorkerFormInput,
} from '@/modules/worker/lib';

function at(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function base(overrides: Partial<WorkerFormInput> = {}): WorkerFormInput {
  return {
    fullName: 'Juan Perez',
    dni: '30111222',
    email: 'juan@ejemplo.com',
    phone: '',
    service: 'jardineria',
    weekdays: [1, 2, 3, 4, 5],
    dailyFrom: at(8),
    dailyUntil: at(18),
    ...overrides,
  };
}

describe('toHHmm', () => {
  it('formatea a HH:mm zero-padded', () => {
    expect(toHHmm(at(8, 0))).toBe('08:00');
    expect(toHHmm(at(23, 59))).toBe('23:59');
    expect(toHHmm(at(0, 5))).toBe('00:05');
  });
});

describe('fromHHmm', () => {
  it('parsea horarios validos', () => {
    const d = fromHHmm('08:30');
    expect(d).not.toBeNull();
    expect(d?.getHours()).toBe(8);
    expect(d?.getMinutes()).toBe(30);
  });

  it('devuelve null con formato invalido', () => {
    expect(fromHHmm('8:30')).toBeNull();
    expect(fromHHmm('24:00')).toBeNull();
    expect(fromHHmm('08:60')).toBeNull();
    expect(fromHHmm('cualquiercosa')).toBeNull();
  });
});

describe('validateWorkerForm', () => {
  it('acepta un input completo y bien formado', () => {
    expect(validateWorkerForm(base())).toBeNull();
  });

  it('rechaza sin nombre', () => {
    expect(validateWorkerForm(base({ fullName: '   ' }))).toBe('FULL_NAME_REQUIRED');
  });

  it('rechaza sin DNI', () => {
    expect(validateWorkerForm(base({ dni: '' }))).toBe('DNI_REQUIRED');
  });

  it('rechaza sin email ni telefono', () => {
    expect(validateWorkerForm(base({ email: ' ', phone: '' }))).toBe('CONTACT_REQUIRED');
  });

  it('acepta solo telefono (#119)', () => {
    expect(validateWorkerForm(base({ email: '', phone: '261 555-0000' }))).toBeNull();
  });

  it('rechaza telefono con letras', () => {
    expect(validateWorkerForm(base({ email: '', phone: 'llamame' }))).toBe('PHONE_INVALID');
  });

  it('rechaza email invalido', () => {
    expect(validateWorkerForm(base({ email: 'no-arroba' }))).toBe('EMAIL_INVALID');
  });

  it('rechaza sin servicio', () => {
    expect(validateWorkerForm(base({ service: '' }))).toBe('SERVICE_REQUIRED');
  });

  it('rechaza sin dias', () => {
    expect(validateWorkerForm(base({ weekdays: [] }))).toBe('WEEKDAYS_REQUIRED');
  });

  it('rechaza sin horarios', () => {
    expect(validateWorkerForm(base({ dailyFrom: null }))).toBe('DAILY_TIMES_REQUIRED');
    expect(validateWorkerForm(base({ dailyUntil: null }))).toBe('DAILY_TIMES_REQUIRED');
  });

  it('rechaza cross-midnight (until <= from)', () => {
    // Sereno 22 a 06: el backend lo rechaza con IllegalArgumentException.
    expect(
      validateWorkerForm(base({ dailyFrom: at(22), dailyUntil: at(6) })),
    ).toBe('DAILY_ORDER_INVALID');
  });

  it('rechaza until == from', () => {
    expect(
      validateWorkerForm(base({ dailyFrom: at(10), dailyUntil: at(10) })),
    ).toBe('DAILY_ORDER_INVALID');
  });
});

describe('validateWorkerSchedule', () => {
  it('acepta un horario completo', () => {
    expect(
      validateWorkerSchedule({
        service: 'jardineria',
        weekdays: [1, 3, 5],
        dailyFrom: at(8),
        dailyUntil: at(18),
      }),
    ).toBeNull();
  });

  it('rechaza campos vacios sin exigir identidad', () => {
    expect(
      validateWorkerSchedule({ service: '', weekdays: [1], dailyFrom: at(8), dailyUntil: at(18) }),
    ).toBe('SERVICE_REQUIRED');
    expect(
      validateWorkerSchedule({
        service: 'x',
        weekdays: [],
        dailyFrom: at(8),
        dailyUntil: at(18),
      }),
    ).toBe('WEEKDAYS_REQUIRED');
    expect(
      validateWorkerSchedule({
        service: 'x',
        weekdays: [1],
        dailyFrom: null,
        dailyUntil: at(18),
      }),
    ).toBe('DAILY_TIMES_REQUIRED');
    expect(
      validateWorkerSchedule({
        service: 'x',
        weekdays: [1],
        dailyFrom: at(18),
        dailyUntil: at(8),
      }),
    ).toBe('DAILY_ORDER_INVALID');
  });
});
