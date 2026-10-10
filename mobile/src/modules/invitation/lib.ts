import type { components } from '@securepass/contracts';

import { isProblemDetail } from '@/common/api/problem';

const DAY_MS = 24 * 60 * 60 * 1000;

// BR-04: SINGLE y EVENT no pueden durar mas de 30 dias. Se reusa en
// validateInvitationForm (guard al submit) y en el clamp del picker
// de validUntil (limite al elegir). Cambiar en un solo lugar.
export const MAX_INVITATION_WINDOW_DAYS = 30;

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatWindow(from?: string, until?: string): string {
  if (!from || !until) return 'Sin ventana';
  return `${formatDateTime(from)} - ${formatDateTime(until)}`;
}

export function remainingUses(
  invitation: components['schemas']['InvitationResponse'],
): number | null {
  if (invitation.maxUses === undefined || invitation.usedCount === undefined) return null;
  return Math.max(invitation.maxUses - invitation.usedCount, 0);
}

export type InvitationFormValues = {
  lotId: string | null;
  type: 'SINGLE' | 'EVENT';
  guestName: string;
  guestDocument: string;
  companions: string;
  validFrom: Date | null;
  validUntil: Date | null;
  maxUses: string;
};

export type InvitationFormResult =
  | { ok: true; payload: components['schemas']['CreateInvitationRequest'] }
  | { ok: false; error: string };

// Validacion client-side coherente con BR-04 (ventana maxima por tipo) y
// BR-05 (cupo de evento hasta 200). El server revalida todo igual.
export function validateInvitationForm(
  values: InvitationFormValues,
): InvitationFormResult {
  if (!values.lotId) return { ok: false, error: 'Elegí un lote.' };
  const guestName = values.guestName.trim();
  if (!guestName) return { ok: false, error: 'Poné el nombre del invitado.' };
  // Se normaliza igual que el backend: puntos, espacios y guiones se
  // sacan antes de validar. Un residente que copia "30.123.456" desde
  // el celular no deberia comerse un error por formato.
  const guestDocument = values.guestDocument.replace(/[.\s-]/g, '');
  if (!guestDocument) {
    return { ok: false, error: 'Poné el DNI del invitado.' };
  }
  if (!/^\d{7,8}$/.test(guestDocument)) {
    return { ok: false, error: 'El DNI va de 7 a 8 digitos.' };
  }
  if (!values.validFrom || !values.validUntil) {
    return { ok: false, error: 'Elegí la ventana de validez.' };
  }
  if (values.validUntil <= values.validFrom) {
    return { ok: false, error: 'El fin de la ventana tiene que ser después del inicio.' };
  }
  const windowDays = (values.validUntil.getTime() - values.validFrom.getTime()) / DAY_MS;
  if (windowDays > MAX_INVITATION_WINDOW_DAYS) {
    return { ok: false, error: 'Un pase único o de evento dura hasta 30 días.' };
  }

  const companions = parseBoundedInt(values.companions, 0, 20);
  if (values.companions.trim() !== '' && companions === null) {
    return { ok: false, error: 'Los acompanantes van de 0 a 20.' };
  }

  let maxUses = 1;
  if (values.type === 'EVENT') {
    maxUses = parseBoundedInt(values.maxUses, 2, 200) ?? -1;
    if (maxUses < 0) return { ok: false, error: 'El cupo de un evento va de 2 a 200.' };
  }

  return {
    ok: true,
    payload: {
      lotId: values.lotId,
      type: values.type,
      guestName,
      guestDocument,
      validFrom: values.validFrom.toISOString(),
      validUntil: values.validUntil.toISOString(),
      maxUses,
      ...(companions !== null ? { companions } : {}),
    },
  };
}

// Mensaje legible para el rechazo del server al crear una invitacion.
// Las rules conocidas (BR-XX) que llegan con prefijo tecnico en el detail
// se mapean a copy humano. Las que no estan mapeadas (o el server no
// mando rule) caen al detail crudo — mas informativo que un generico.
// BR-05: el spec menciona "aprobacion de ADMIN" para superar 200 pero
// no existe endpoint de aprobacion, no prometemos al residente un flow
// que no existe.
const BR_MESSAGES: Record<string, string> = {
  'BR-03': 'El lote esta suspendido por mora y no acepta invitaciones. Comunicate con la administración del barrio.',
  'BR-04': 'El pase no puede durar más de 30 días. Ajustá la fecha de fin.',
  'BR-05': 'Un evento admite hasta 200 usos.',
};

export function createInvitationErrorMessage(raw: unknown): string {
  if (!isProblemDetail(raw)) {
    return 'El server rechazó la invitación. Revisá los datos.';
  }
  const humanMessage = raw.rule ? BR_MESSAGES[raw.rule] : undefined;
  if (humanMessage) return humanMessage;
  return raw.detail ?? 'El server rechazó la invitación. Revisá los datos.';
}

function parseBoundedInt(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

const MAX_SHARE_LINE_CHARS = 34;

export function truncateShareLine(value: string): string {
  if (value.length <= MAX_SHARE_LINE_CHARS) return value;
  return `${value.slice(0, MAX_SHARE_LINE_CHARS - 1)}…`;
}

// Lineas de la tarjeta que se comparte (spec US-11): invitado, barrio,
// lote con ventana y el link del pase.
export function shareLines(
  invitation: components['schemas']['InvitationResponse'],
  lotCode: string | null,
  neighborhoodName: string | null,
): string[] {
  const lines: string[] = [];
  if (invitation.guestName) lines.push(truncateShareLine(invitation.guestName));
  if (neighborhoodName || lotCode) {
    const parts = [neighborhoodName, lotCode ? `Lote ${lotCode}` : null];
    lines.push(truncateShareLine(parts.filter((part) => part !== null).join(' - ')));
  }
  if (invitation.validFrom && invitation.validUntil) {
    lines.push(truncateShareLine(formatWindow(invitation.validFrom, invitation.validUntil)));
  }
  if (invitation.shareUrl) lines.push(truncateShareLine(invitation.shareUrl));
  return lines;
}
