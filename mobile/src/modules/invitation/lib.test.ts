import { describe, expect, it } from 'vitest';

import {
  createInvitationErrorMessage,
  formatWindow,
  remainingUses,
  shareLines,
  truncateShareLine,
  validateInvitationForm,
  type InvitationFormValues,
} from '@/modules/invitation/lib';

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

function baseValues(): InvitationFormValues {
  return {
    lotId: 'lot-1',
    type: 'SINGLE',
    guestName: 'Maria Lopez',
    guestDocument: '30123456',
    companions: '',
    validFrom: new Date('2026-08-20T18:00:00Z'),
    validUntil: new Date('2026-08-20T23:59:00Z'),
    maxUses: '',
  };
}

describe('createInvitationErrorMessage', () => {
  it('BR-03 tiene mensaje de lote suspendido', () => {
    expect(createInvitationErrorMessage({ status: 422, type: 'business-rule-violation', rule: 'BR-03' }))
      .toContain('suspendido');
  });

  it('usa el detail del server para otros rechazos', () => {
    expect(
      createInvitationErrorMessage({ status: 422, type: 'business-rule-violation', rule: 'BR-01', detail: 'usuario sin permiso para invitar en este lote' }),
    ).toBe('usuario sin permiso para invitar en este lote');
  });

  it('BR-04 tiene mensaje humano sobre ventana maxima', () => {
    expect(
      createInvitationErrorMessage({
        status: 422,
        type: 'business-rule-violation',
        rule: 'BR-04',
        detail: 'BR-04: ventana excede 30 dias para SINGLE',
      }),
    ).toBe('El pase no puede durar más de 30 días. Ajustá la fecha de fin.');
  });

  it('BR-05 tiene mensaje humano sobre cupo maximo de evento', () => {
    expect(
      createInvitationErrorMessage({
        status: 422,
        type: 'business-rule-violation',
        rule: 'BR-05',
        detail: 'BR-05: max_uses de EVENT supera 200',
      }),
    ).toBe('Un evento admite hasta 200 usos.');
  });

  it('sin problem detail cae al mensaje generico', () => {
    expect(createInvitationErrorMessage('caida de red')).toContain('Revisá los datos');
  });
});

describe('validateInvitationForm', () => {
  it('exige DNI del invitado (D-08)', () => {
    expect(validateInvitationForm({ ...baseValues(), guestDocument: '' })).toMatchObject({
      ok: false,
      error: 'Poné el DNI del invitado.',
    });
    expect(validateInvitationForm({ ...baseValues(), guestDocument: '123456' })).toMatchObject({
      ok: false,
      error: 'El DNI va de 7 a 8 digitos.',
    });
    expect(validateInvitationForm({ ...baseValues(), guestDocument: '123456789' })).toMatchObject({
      ok: false,
    });
    expect(validateInvitationForm({ ...baseValues(), guestDocument: 'abc12345' })).toMatchObject({
      ok: false,
    });
  });

  it('normaliza puntos, espacios y guiones antes de validar y enviar', () => {
    // Los formatos que un residente copia del celular ("30.123.456",
    // "30 123 456") no deberian rechazarse: se sacan separadores y se
    // valida solo digitos, igual que el backend.
    for (const raw of ['30.123.456', '30 123 456', '30-123-456', ' 30123456 ']) {
      const result = validateInvitationForm({ ...baseValues(), guestDocument: raw });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.payload.guestDocument).toBe('30123456');
    }
  });

  it('valida un pase SINGLE con cupo forzado en 1', () => {
    const result = validateInvitationForm(baseValues());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.maxUses).toBe(1);
      expect(result.payload.type).toBe('SINGLE');
    }
  });

  it('valida un EVENTO con cupo entre 2 y 200 (BR-05)', () => {
    const result = validateInvitationForm({
      ...baseValues(),
      type: 'EVENT',
      maxUses: '200',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.maxUses).toBe(200);

    expect(validateInvitationForm({ ...baseValues(), type: 'EVENT', maxUses: '1' })).toMatchObject({
      ok: false,
    });
    expect(
      validateInvitationForm({ ...baseValues(), type: 'EVENT', maxUses: '201' }),
    ).toMatchObject({ ok: false });
    expect(
      validateInvitationForm({ ...baseValues(), type: 'EVENT', maxUses: 'abc' }),
    ).toMatchObject({ ok: false });
  });

  it('rechaza ventana invertida o vacia', () => {
    expect(
      validateInvitationForm({
        ...baseValues(),
        validFrom: baseValues().validUntil,
        validUntil: baseValues().validFrom,
      }),
    ).toMatchObject({ ok: false });
    expect(validateInvitationForm({ ...baseValues(), validFrom: null })).toMatchObject({
      ok: false,
    });
  });

  it('aplica BR-04: 30 dias maximo para SINGLE y EVENT', () => {
    const from = new Date('2026-08-20T18:00:00Z');
    const beyond30 = new Date(from.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(
      validateInvitationForm({ ...baseValues(), validFrom: from, validUntil: beyond30 }),
    ).toMatchObject({ ok: false });
    expect(
      validateInvitationForm({ ...baseValues(), type: 'EVENT', maxUses: '10', validFrom: from, validUntil: beyond30 }),
    ).toMatchObject({ ok: false });
  });

  it('rechaza nombre vacio y acompanantes fuera de rango', () => {
    expect(validateInvitationForm({ ...baseValues(), guestName: '  ' })).toMatchObject({
      ok: false,
    });
    expect(validateInvitationForm({ ...baseValues(), companions: '21' })).toMatchObject({
      ok: false,
    });
    expect(validateInvitationForm({ ...baseValues(), companions: 'abc' })).toMatchObject({
      ok: false,
    });
  });

  it('incluye acompanantes y documento cuando estan completos', () => {
    const result = validateInvitationForm({
      ...baseValues(),
      companions: '3',
      guestDocument: '30123456',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.companions).toBe(3);
      expect(result.payload.guestDocument).toBe('30123456');
    }
  });
});

describe('shareLines', () => {
  it('arma las lineas de la tarjeta: invitado, barrio y lote, ventana y link', () => {
    const lines = shareLines(
      {
        guestName: 'Maria Lopez',
        neighborhoodName: 'Barrio Las Acacias',
        shareUrl: 'https://securepass.app/i/abc123',
        validFrom: '2026-08-20T18:00:00Z',
        validUntil: '2026-08-20T23:59:00Z',
      },
      'M4-L12',
      'Barrio Las Acacias',
    );
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('Maria Lopez');
    expect(lines[1]).toBe('Barrio Las Acacias - Lote M4-L12');
    expect(lines[3]).toBe('https://securepass.app/i/abc123');
  });

  it('omite lineas sin datos', () => {
    expect(shareLines({}, null, null)).toEqual([]);
    expect(shareLines({ guestName: 'Juan' }, null, null)).toEqual(['Juan']);
  });

  it('trunca lineas largas', () => {
    const long = 'a'.repeat(60);
    const truncated = truncateShareLine(long);
    expect(truncated.length).toBeLessThan(long.length);
    expect(truncated.endsWith('…')).toBe(true);
    expect(truncateShareLine('corto')).toBe('corto');
  });
});
