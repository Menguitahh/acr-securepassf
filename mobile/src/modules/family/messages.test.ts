import { describe, expect, it } from 'vitest';

import {
  messageForAddOutcome,
  messageForConflictCode,
  messageForReactivation,
  messageForUpdateOutcome,
} from '@/modules/family/messages';

describe('messageForAddOutcome', () => {
  const base = { userId: 'u1', fullName: 'Maria', email: 'maria@dev.local' };

  it('CREATED_USER_AND_PERMISSION menciona el email de activacion', () => {
    const msg = messageForAddOutcome({ ...base, outcome: 'CREATED_USER_AND_PERMISSION' });
    expect(msg).toContain('Maria');
    expect(msg).toContain('maria@dev.local');
    expect(msg).toContain('activación');
  });

  it('ADDED_PERMISSION indica que ya tenia cuenta', () => {
    const msg = messageForAddOutcome({ ...base, outcome: 'ADDED_PERMISSION' });
    expect(msg).toContain('ya tenía cuenta');
  });

  it('REACTIVATED_PERMISSION senala que reactivo a alguien dado de baja', () => {
    const msg = messageForAddOutcome({ ...base, outcome: 'REACTIVATED_PERMISSION' });
    expect(msg).toContain('estaba dado de baja');
    expect(msg).toContain('reactivó');
  });

  it('ALREADY_MEMBER dice que nada cambio', () => {
    const msg = messageForAddOutcome({ ...base, outcome: 'ALREADY_MEMBER' });
    expect(msg).toContain('Nada cambió');
  });

  it('outcome desconocido cae al fallback generico, no muestra undefined ni el enum crudo', () => {
    // Simula un backend que agrega FUTURE_OUTCOME sin que el mobile lo
    // conozca. UI no puede quedar mostrando undefined ni "FUTURE_OUTCOME".
    const msg = messageForAddOutcome({
      ...base,
      outcome: 'FUTURE_OUTCOME' as never,
    });
    expect(msg).toBe('Maria agregado al lote.');
    expect(msg).not.toContain('undefined');
    expect(msg).not.toContain('FUTURE_OUTCOME');
  });

  it('outcome ausente cae al fallback', () => {
    const msg = messageForAddOutcome(base);
    expect(msg).toBe('Maria agregado al lote.');
  });
});

describe('messageForUpdateOutcome', () => {
  const base = { userId: 'u1', fullName: 'Juan' };

  it('REVOKED_MEMBER con count=0 no menciona pases', () => {
    const msg = messageForUpdateOutcome({
      ...base,
      outcome: 'REVOKED_MEMBER',
      revokedInvitationsCount: 0,
    });
    expect(msg).toBe('Juan fue dado de baja.');
  });

  it('REVOKED_MEMBER con count=1 usa singular', () => {
    const msg = messageForUpdateOutcome({
      ...base,
      outcome: 'REVOKED_MEMBER',
      revokedInvitationsCount: 1,
    });
    expect(msg).toContain('1 pase activo');
    expect(msg).not.toContain('pases activos');
  });

  it('REVOKED_MEMBER con count>1 usa plural', () => {
    const msg = messageForUpdateOutcome({
      ...base,
      outcome: 'REVOKED_MEMBER',
      revokedInvitationsCount: 3,
    });
    expect(msg).toContain('3 pases activos');
  });

  it('ALREADY_INACTIVE es idempotente', () => {
    const msg = messageForUpdateOutcome({ ...base, outcome: 'ALREADY_INACTIVE' });
    expect(msg).toContain('ya estaba dado de baja');
  });

  it('TOGGLED_CAN_INVITE describe el permiso', () => {
    const msg = messageForUpdateOutcome({ ...base, outcome: 'TOGGLED_CAN_INVITE' });
    expect(msg).toContain('permiso de invitar');
  });

  it('outcome desconocido cae al fallback generico', () => {
    const msg = messageForUpdateOutcome({ ...base, outcome: 'NEW_OUTCOME' as never });
    expect(msg).toBe('Se actualizó Juan.');
    expect(msg).not.toContain('undefined');
    expect(msg).not.toContain('NEW_OUTCOME');
  });
});

describe('messageForReactivation', () => {
  it('confirma que volvió el acceso al lote', () => {
    const msg = messageForReactivation('Juan');
    expect(msg).toContain('Juan');
    expect(msg).toContain('volvió a tener acceso al lote');
  });

  it('avisa explicitamente que el permiso de invitar quedó desactivado', () => {
    // Regresion #63: el titular tiene que enterarse del reset de canInvite
    // sin tener que mirar la fila despues.
    const msg = messageForReactivation('Ana');
    expect(msg).toContain('permiso para invitar');
    expect(msg).toContain('desactivado');
  });
});

describe('messageForConflictCode', () => {
  it('USER_SUSPENDED empuja a coordinar con administracion', () => {
    const msg = messageForConflictCode('USER_SUSPENDED');
    expect(msg).toContain('suspendida');
    expect(msg).toContain('administración');
  });

  it('USER_DELETED tambien manda a administracion', () => {
    const msg = messageForConflictCode('USER_DELETED');
    expect(msg).toContain('dada de baja');
    expect(msg).toContain('administración');
  });

  it('code desconocido cae al mensaje generico de conflicto', () => {
    expect(messageForConflictCode('SOMETHING_NEW')).toContain('administración');
    expect(messageForConflictCode(undefined)).toContain('administración');
  });
});
