import { isValidEmail } from '@/modules/family/email';
import { WEEKDAY_LABELS } from '@/modules/worker/data';

// HH:mm en 24h, zero-padded. Mismo formato que espera el backend
// (AddWorkerRequest.dailyFrom/Until, pattern ^([01]\d|2[0-3]):[0-5]\d$).
export function toHHmm(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Parse "HH:mm" a un Date con la fecha de hoy. Solo se usa para
// prefill/edicion. Tolera basura: null si no matchea.
export function fromHHmm(hhmm: string): Date | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return null;
  const now = new Date();
  now.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return now;
}

export type WorkerScheduleInput = {
  service: string;
  weekdays: number[];
  dailyFrom: Date | null;
  dailyUntil: Date | null;
};

export type WorkerFormInput = WorkerScheduleInput & {
  fullName: string;
  dni: string;
  email: string;
  phone: string;
};

export type WorkerFormError =
  | 'FULL_NAME_REQUIRED'
  | 'DNI_REQUIRED'
  | 'CONTACT_REQUIRED'
  | 'EMAIL_INVALID'
  | 'PHONE_INVALID'
  | 'SERVICE_REQUIRED'
  | 'WEEKDAYS_REQUIRED'
  | 'DAILY_TIMES_REQUIRED'
  | 'DAILY_ORDER_INVALID';

// Solo servicio + weekdays + horarios. Es lo que edita el titular en el edit
// modal (los datos de identidad no cambian) y lo unico que el PATCH acepta.
export function validateWorkerSchedule(input: WorkerScheduleInput): WorkerFormError | null {
  if (input.service.trim().length === 0) return 'SERVICE_REQUIRED';
  if (input.weekdays.length === 0) return 'WEEKDAYS_REQUIRED';
  if (!input.dailyFrom || !input.dailyUntil) return 'DAILY_TIMES_REQUIRED';
  if (toHHmm(input.dailyUntil) <= toHHmm(input.dailyFrom)) return 'DAILY_ORDER_INVALID';
  return null;
}

// Espeja las restricciones de AddWorkerRequest.java + la validacion cross-field
// isDailyOrderValid. Todo lo que aca deje pasar, el server tambien lo acepta;
// todo lo que aca rechace, el server rechazaria tambien pero con 400 generico.
// Prevalidar en el cliente da mensajes especificos por campo.
//
// Cross-midnight: el backend no soporta turnos que cruzan medianoche
// (ScheduleWindow.java:33 -> IllegalArgumentException). El form no lo permite.
export function validateWorkerForm(input: WorkerFormInput): WorkerFormError | null {
  if (input.fullName.trim().length === 0) return 'FULL_NAME_REQUIRED';
  if (input.dni.trim().length === 0) return 'DNI_REQUIRED';
  // #119: email o telefono. Sin email no hay cuenta: entra por DNI en garita.
  const email = input.email.trim();
  const phone = input.phone.trim();
  if (email.length === 0 && phone.length === 0) return 'CONTACT_REQUIRED';
  if (email.length > 0 && !isValidEmail(email)) return 'EMAIL_INVALID';
  if (phone.length > 0 && !/^[0-9+()\s-]{6,30}$/.test(phone)) return 'PHONE_INVALID';
  return validateWorkerSchedule(input);
}

export const FORM_ERROR_MESSAGES: Record<WorkerFormError, string> = {
  FULL_NAME_REQUIRED: 'Nombre completo requerido.',
  DNI_REQUIRED: 'DNI requerido.',
  CONTACT_REQUIRED: 'Cargá un email o un teléfono del trabajador.',
  EMAIL_INVALID: 'Email invalido. Revisá el formato.',
  PHONE_INVALID: 'Teléfono inválido. Usá solo números, espacios, + o guiones.',
  SERVICE_REQUIRED: 'Servicio requerido (ej. jardineria, plomeria).',
  WEEKDAYS_REQUIRED: 'Elegí al menos un día de la semana.',
  DAILY_TIMES_REQUIRED: 'Cargá el horario de inicio y de fin.',
  DAILY_ORDER_INVALID:
    'El horario de fin tiene que ser posterior al de inicio. Los turnos que cruzan la medianoche no se pueden cargar.',
};

// "L M M J V · 08:00–18:00". Lo usan la lista del titular y la pantalla del
// trabajador (US-65).
export function formatSchedule(
  weekdays: readonly number[] | undefined,
  dailyFrom: string | undefined,
  dailyUntil: string | undefined,
): string {
  const days = (weekdays ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((iso) => WEEKDAY_LABELS[iso - 1]?.label ?? '')
    .filter((label) => label.length > 0)
    .join(' ');
  return `${days || 'Sin días'} · ${dailyFrom ?? '--:--'}–${dailyUntil ?? '--:--'}`;
}
