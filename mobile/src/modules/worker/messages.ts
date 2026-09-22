import type { components } from '@securepass/contracts';

type Outcome = NonNullable<components['schemas']['AddWorkerResponse']['outcome']>;

// Espeja los outcomes que devuelve AddWorkerUseCase.java. El titular ve
// exactamente que paso en cada caso, sin jerga tecnica.
const OUTCOME_MESSAGES: Record<Outcome, string> = {
  CREATED_USER_AND_PERMISSION:
    'Trabajador habilitado. Le enviamos un correo para activar la cuenta.',
  ADDED_PERMISSION: 'Trabajador habilitado en este lote.',
  REACTIVATED_PERMISSION: 'Se reactivó el permiso del trabajador en este lote.',
  ALREADY_ACTIVE: 'Este trabajador ya está habilitado en este lote.',
};

export function messageForAddOutcome(
  response: components['schemas']['AddWorkerResponse'],
): string {
  const outcome = response.outcome;
  if (!outcome) return 'Trabajador habilitado.';
  return OUTCOME_MESSAGES[outcome];
}

export function toneForOutcome(
  outcome: Outcome | undefined,
): 'success' | 'warning' | 'info' {
  if (outcome === 'REACTIVATED_PERMISSION') return 'warning';
  if (outcome === 'ALREADY_ACTIVE') return 'info';
  return 'success';
}

type UpdateOutcome = NonNullable<components['schemas']['UpdateWorkerResponse']['outcome']>;

// Solo UPDATED es alcanzable desde el edit modal (no manda `active`).
// DEACTIVATED / ALREADY_INACTIVE / ALREADY_ACTIVE quedan para el flujo
// de baja/reactivacion (E).
const UPDATE_OUTCOME_MESSAGES: Record<UpdateOutcome, string> = {
  UPDATED: 'Cambios guardados.',
  DEACTIVATED: 'Trabajador dado de baja.',
  ALREADY_INACTIVE: 'El trabajador ya estaba inactivo.',
  ALREADY_ACTIVE: 'El trabajador ya estaba activo.',
};

export function messageForUpdateOutcome(
  response: components['schemas']['UpdateWorkerResponse'],
): string {
  const outcome = response.outcome;
  if (!outcome) return 'Cambios guardados.';
  return UPDATE_OUTCOME_MESSAGES[outcome];
}

export function toneForUpdateOutcome(
  outcome: UpdateOutcome | undefined,
): 'success' | 'warning' | 'info' {
  if (outcome === 'DEACTIVATED') return 'warning';
  if (outcome === 'ALREADY_INACTIVE' || outcome === 'ALREADY_ACTIVE') return 'info';
  return 'success';
}

// Mensajes para 409 UserOnboardingConflictException. USER_SUSPENDED /
// USER_DELETED requieren accion humana (contacto con admin del barrio).
// EMAIL_TAKEN es el caso comun: el email ya esta con otro DNI, el titular
// tiene que revisar.
export function messageForConflictCode(code: string): string {
  if (code === 'USER_SUSPENDED') {
    return 'Este DNI corresponde a un usuario suspendido. Coordiná con la administración antes de habilitarlo.';
  }
  if (code === 'USER_DELETED') {
    return 'Este DNI corresponde a un usuario dado de baja. No se puede reactivar desde acá.';
  }
  if (code === 'EMAIL_TAKEN') {
    return 'Ese email ya está registrado con otro DNI. Revisá los datos.';
  }
  return 'No se pudo completar el alta. Revisá los datos e intentá de nuevo.';
}
