import type { components } from '@securepass/contracts';

/**
 * WBS-113: mensajes user-facing para los outcomes de alta y baja de familiar.
 * Fallback a mensaje generico si el backend agrega un outcome nuevo — la UI
 * no debe mostrar undefined ni el string del enum crudo al titular.
 */

type AddOutcome = NonNullable<components['schemas']['AddFamilyMemberResponse']['outcome']>;

const ADD_MESSAGES: Record<AddOutcome, (name: string, email: string) => string> = {
  CREATED_USER_AND_PERMISSION: (name, email) =>
    `${name} sumado al lote. Se envió un email de activación a ${email}.`,
  ADDED_PERMISSION: (name) => `${name} ya tenía cuenta. Sumado al lote.`,
  REACTIVATED_PERMISSION: (name) =>
    `${name} estaba dado de baja. Se reactivó su acceso al lote.`,
  ALREADY_MEMBER: (name) => `${name} ya era miembro del lote. Nada cambió.`,
};

export function messageForAddOutcome(
  result: components['schemas']['AddFamilyMemberResponse'],
): string {
  const name = result.fullName ?? 'La persona';
  const email = result.email ?? '';
  const outcome = result.outcome;
  if (outcome && outcome in ADD_MESSAGES) {
    return ADD_MESSAGES[outcome as AddOutcome](name, email);
  }
  // Fallback: outcome nuevo desconocido o ausente. No mostrar el enum
  // crudo al titular. Se sabe que fue exitoso porque el hook solo
  // llama a este helper con response 2xx.
  return `${name} agregado al lote.`;
}

export function messageForUpdateOutcome(
  result: components['schemas']['UpdateFamilyMemberResponse'],
): string {
  const name = result.fullName ?? 'El miembro';
  const count = result.revokedInvitationsCount ?? 0;
  switch (result.outcome) {
    case 'REVOKED_MEMBER':
      return count > 0
        ? `${name} fue dado de baja. Se revocaron ${count} ${count === 1 ? 'pase activo' : 'pases activos'}.`
        : `${name} fue dado de baja.`;
    case 'ALREADY_INACTIVE':
      return `${name} ya estaba dado de baja.`;
    case 'TOGGLED_CAN_INVITE':
      return `Se actualizó el permiso de invitar de ${name}.`;
    default:
      // Fallback: outcome nuevo. No mostrar undefined ni el enum crudo.
      return `Se actualizó ${name}.`;
  }
}

/**
 * WBS-113 issue #63: la reactivacion se hace via PATCH { active: true,
 * canInvite: false }, pero el back devuelve outcome TOGGLED_CAN_INVITE
 * (no existe REACTIVATED_PERMISSION en el enum del PATCH). El mensaje
 * al titular tiene que reflejar la intent real: reactivo, y el permiso
 * de invitar arranca desactivado. Reset explicito por decision de
 * seguridad — dar de baja puede haber sido por abuso del canInvite,
 * devolver el permiso en silencio seria un vector no auditado.
 */
export function messageForReactivation(name: string): string {
  return `${name} volvió a tener acceso al lote. El permiso para invitar quedó desactivado.`;
}

/**
 * WBS-113: mensaje para el 409 de USER_SUSPENDED / USER_DELETED que devuelve
 * el back cuando el DNI corresponde a un user en estado no reactivable.
 * El titular no tiene forma de resolverlo solo (no hay flujo autoservicio
 * para desuspender); el mensaje lo empuja a coordinar con administracion.
 */
export function messageForConflictCode(code: string | undefined): string {
  switch (code) {
    case 'USER_SUSPENDED':
      return 'Esta persona figura como suspendida en el sistema. Contactá a la administración para coordinar antes de darle acceso.';
    case 'USER_DELETED':
      return 'Esta persona figura como dada de baja en el sistema. Contactá a la administración.';
    default:
      return 'Hay un conflicto con esta persona en el sistema. Contactá a la administración.';
  }
}
