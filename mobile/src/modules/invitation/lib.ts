import type { components } from '@securepass/contracts';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  type: 'SINGLE' | 'EVENT' | 'RECURRING';
  guestName: string;
  guestDocument: string;
  companions: string;
  validFrom: Date | null;
  validUntil: Date | null;
  maxUses: string;
  weekdays: number[];
  dailyFrom: Date | null;
  dailyUntil: Date | null;
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
  if (!values.validFrom || !values.validUntil) {
    return { ok: false, error: 'Elegí la ventana de validez.' };
  }
  if (values.validUntil <= values.validFrom) {
    return { ok: false, error: 'El fin de la ventana tiene que ser despues del inicio.' };
  }
  const windowDays = (values.validUntil.getTime() - values.validFrom.getTime()) / DAY_MS;
  if (values.type === 'RECURRING' && windowDays > 365) {
    return { ok: false, error: 'Un pase recurrente dura hasta 365 dias.' };
  }
  if (values.type !== 'RECURRING' && windowDays > 30) {
    return { ok: false, error: 'Un pase unico o de evento dura hasta 30 dias.' };
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

  if (values.type === 'RECURRING') {
    if (values.weekdays.length === 0) {
      return { ok: false, error: 'Elegí al menos un dia de la semana.' };
    }
    if (!values.dailyFrom || !values.dailyUntil) {
      return { ok: false, error: 'Elegí la franja horaria.' };
    }
  }

  const guestDocument = values.guestDocument.trim();
  return {
    ok: true,
    payload: {
      lotId: values.lotId,
      type: values.type,
      guestName,
      validFrom: values.validFrom.toISOString(),
      validUntil: values.validUntil.toISOString(),
      maxUses,
      ...(guestDocument ? { guestDocument } : {}),
      ...(companions !== null ? { companions } : {}),
      ...(values.type === 'RECURRING' && values.dailyFrom && values.dailyUntil
        ? {
            weekdays: values.weekdays,
            dailyFrom: { hour: values.dailyFrom.getHours(), minute: values.dailyFrom.getMinutes() },
            dailyUntil: { hour: values.dailyUntil.getHours(), minute: values.dailyUntil.getMinutes() },
          }
        : {}),
    },
  };
}

function parseBoundedInt(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}
