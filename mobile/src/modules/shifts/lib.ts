import type { Shift } from '@/modules/shifts/types';

export function isOpenShift(shift: Shift | null | undefined): shift is Shift {
  if (!shift) return false;
  return typeof shift.id === 'string' && !shift.endedAt;
}

// Parseo de GET /shifts/current. 204 = sin turno abierto (estado valido,
// nunca error). Cualquier otra combinacion sin data o con error del server
// es falla real -> throw para que la query caiga a ErrorState.
export function parseCurrentShift(
  status: number,
  data: Shift | undefined,
  error: unknown,
): Shift | null {
  if (status === 204) return null;
  if (error || !data) throw new Error('No se pudo cargar el turno actual.');
  return data;
}

const SHIFT_FIELDS = [
  'id',
  'neighborhoodId',
  'gateId',
  'guardId',
  'startedAt',
  'endedAt',
  'handoverNotes',
] as const;

// #204: ultimo turno conocido, guardado para arrancar sin red. null = el
// server dijo que no habia turno; undefined = nada guardado o ilegible.
export function parseStoredShift(raw: string | null): Shift | null | undefined {
  if (raw === null) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (value === null) return null;
  if (typeof value !== 'object') return undefined;
  const shift: Shift = {};
  for (const key of SHIFT_FIELDS) {
    const field: unknown = Reflect.get(value, key);
    if (typeof field === 'string') shift[key] = field;
  }
  return typeof shift.id === 'string' ? shift : undefined;
}

export function elapsedMinutes(startedAtIso: string | undefined, now: number): number | null {
  if (!startedAtIso) return null;
  const started = Date.parse(startedAtIso);
  if (Number.isNaN(started)) return null;
  const diff = Math.max(0, now - started);
  return Math.floor(diff / 60_000);
}

// "3h 12m" / "45m" / "0m". No usa Intl porque las variantes en es-AR
// para duracion son verbosas ("3 horas 12 minutos"); en garita conviene
// algo escaneable con vista periferica.
export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

// Decide que dialogo mostrar cuando el guardia tapea "Cerrar turno".
// La logica de eleccion es pura y separada de la vista para poder
// testearla (Alert.alert es nativo, no testeable directo con vitest).
//
// - 'confirm-with-open': hay N > 0 estadias abiertas conocidas. Se
//   advierte con conteo y se ofrecen tres opciones (marcar egresos /
//   cerrar igual / cancelar).
// - 'confirm-empty': N == 0 estadias abiertas. Confirmacion generica
//   ("Cerrar el turno actual?").
// - 'warn-unknown': no se pudo verificar (sin red o error del server).
//   Se deja cerrar con aviso — un guardia sin red no puede quedar
//   trabado sin poder cerrar su turno.
// - 'disabled': todavia cargando por primera vez sin cache. El boton
//   se muestra con label "Verificando estadias..." en vez de cerrar.
export type CloseDialogChoice =
  | { kind: 'confirm-with-open'; count: number }
  | { kind: 'confirm-empty' }
  | { kind: 'warn-unknown' }
  | { kind: 'disabled' };

export type CloseDialogInput = {
  isLoading: boolean;
  isError: boolean;
  count: number | undefined;
};

export function pickCloseDialog(input: CloseDialogInput): CloseDialogChoice {
  if (input.isError) return { kind: 'warn-unknown' };
  if (input.count === undefined) {
    // Sin cache y todavia cargando: no confirmar aun. Cuando llegue la
    // data el boton se re-renderiza y el tap siguiente elige entre
    // confirm-with-open y confirm-empty.
    if (input.isLoading) return { kind: 'disabled' };
    // Sin loading, sin error, sin count: raro (query aborto sin
    // reportar error). Tratar como desconocido en vez de asumir 0.
    return { kind: 'warn-unknown' };
  }
  if (input.count > 0) return { kind: 'confirm-with-open', count: input.count };
  return { kind: 'confirm-empty' };
}
