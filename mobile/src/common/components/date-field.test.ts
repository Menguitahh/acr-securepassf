import { describe, expect, it } from 'vitest';

import { formatDateFieldValue } from './date-field-format';

describe('formatDateFieldValue', () => {
  const d = new Date(2026, 2, 15, 9, 5); // 15 mar 2026 09:05

  it('null -> "Elegir"', () => {
    expect(formatDateFieldValue(null, 'date')).toBe('Elegir');
    expect(formatDateFieldValue(null, 'time')).toBe('Elegir');
    expect(formatDateFieldValue(null, 'datetime')).toBe('Elegir');
  });

  it('date -> dd/mm/yyyy es-AR', () => {
    expect(formatDateFieldValue(d, 'date')).toMatch(/15\/0?3\/2026/);
  });

  it('time -> hh:mm es-AR', () => {
    expect(formatDateFieldValue(d, 'time')).toMatch(/09:05/);
  });

  it('datetime -> dd/mm hh:mm', () => {
    const out = formatDateFieldValue(d, 'datetime');
    expect(out).toMatch(/15\/0?3/);
    expect(out).toMatch(/09:05/);
  });
});
