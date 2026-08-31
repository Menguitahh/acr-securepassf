// WBS-118 + securepassf #64: evaluacion de franja horaria compartida por
// worker (permisos de trabajador) e invitaciones RECURRING. La tz es
// argumento del caller (tz del barrio), nunca la del dispositivo.
//
// La firma se congela primero para que los tests golden vivan detras de una
// interfaz estable; el cuerpo se implementa recien cuando el probe de
// Hermes+Intl decida entre Intl.DateTimeFormat y una lib con tzdata (ej
// @date-fns/tz). Los tests no se reescriben en ninguno de los dos caminos.
//
// Paridad con backend ScheduleWindow.contains (Java):
//   - weekdays ISO 1..7 (1=lunes .. 7=domingo)
//   - dailyFrom y dailyUntil en "HH:mm", ambos inclusive
//   - fail-closed: tz vacia, weekdays vacio, formatos invalidos => false
//   - una hora local en la tz del argumento, nunca la del dispositivo

export type ScheduleWindow = {
  weekdays: number[]; // ISO: 1=lunes..7=domingo
  dailyFrom: string; // "HH:mm"
  dailyUntil: string; // "HH:mm"
};

export function scheduleContains(
  window: ScheduleWindow,
  capturedAtSeconds: number,
  timezone: string,
): boolean {
  void window;
  void capturedAtSeconds;
  void timezone;
  throw new Error('scheduleContains no implementado: pendiente decision Intl vs tzdata (WBS-118)');
}
