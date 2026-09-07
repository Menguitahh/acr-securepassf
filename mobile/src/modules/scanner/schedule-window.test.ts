import { describe, expect, it } from 'vitest';

import { scheduleContains, type ScheduleWindow } from '@/modules/scanner/schedule-window';

// Vectores golden copiados literal de securepassb ScheduleWindowTest.java
// (com.securepass.shared.schedule). Cualquier drift entre cliente y server en
// esta funcion es un fallo de acceso: mismo predicado, mismo resultado. Si un
// vector cambia aca, cambia primero alla.
//
// Todos los Instant se expresan como epoch seconds para que casen con
// OfflineContext.now (segundos, no milis) usado por validateOffline.

const MZA = 'America/Argentina/Mendoza'; // UTC-3 fijo, sin DST
const TOKYO = 'Asia/Tokyo'; // UTC+9 fijo

function epoch(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

function window(weekdays: number[], from: string, until: string): ScheduleWindow {
  return { weekdays, dailyFrom: from, dailyUntil: until };
}

// pendiente: implementar scheduleContains, ver issue #64
describe('scheduleContains — paridad con backend ScheduleWindow', () => {
  it('martes a las 10 dentro de martes/jueves 8-12', () => {
    const w = window([2, 4], '08:00', '12:00');
    // martes 2026-03-03 10:00 Mza = 13:00Z
    expect(scheduleContains(w, epoch('2026-03-03T13:00:00Z'), MZA)).toBe(true);
  });

  it('miercoles fuera del set de dias', () => {
    const w = window([2, 4], '08:00', '12:00');
    expect(scheduleContains(w, epoch('2026-03-04T13:00:00Z'), MZA)).toBe(false);
  });

  it('justo en dailyFrom incluido', () => {
    const w = window([2], '08:00', '12:00');
    // martes 2026-03-03 08:00 Mza = 11:00Z
    expect(scheduleContains(w, epoch('2026-03-03T11:00:00Z'), MZA)).toBe(true);
  });

  it('justo en dailyUntil incluido', () => {
    const w = window([2], '08:00', '12:00');
    // martes 2026-03-03 12:00 Mza = 15:00Z
    expect(scheduleContains(w, epoch('2026-03-03T15:00:00Z'), MZA)).toBe(true);
  });

  it('un minuto despues de dailyUntil fuera', () => {
    // El backend testea "un segundo despues"; el cliente evalua con precision
    // de minuto porque parsea "HH:mm". La regla equivalente es "un minuto
    // despues de dailyUntil fuera" — mismo criterio, distinta resolucion.
    const w = window([2], '08:00', '12:00');
    expect(scheduleContains(w, epoch('2026-03-03T15:01:00Z'), MZA)).toBe(false);
  });
});

// pendiente: implementar scheduleContains, ver issue #64
describe('scheduleContains — fail-closed', () => {
  it('timezone vacia devuelve false, no throw', () => {
    const w = window([2], '08:00', '12:00');
    expect(scheduleContains(w, epoch('2026-03-03T13:00:00Z'), '')).toBe(false);
  });

  it('timezone invalida devuelve false, no throw', () => {
    const w = window([2], '08:00', '12:00');
    expect(scheduleContains(w, epoch('2026-03-03T13:00:00Z'), 'No/Existe')).toBe(false);
  });

  it('weekdays vacio devuelve false', () => {
    const w = window([], '08:00', '12:00');
    expect(scheduleContains(w, epoch('2026-03-03T13:00:00Z'), MZA)).toBe(false);
  });

  it('formato de hora invalido devuelve false', () => {
    const w = window([2], '25:00', '99:99');
    expect(scheduleContains(w, epoch('2026-03-03T13:00:00Z'), MZA)).toBe(false);
  });
});

// pendiente: implementar scheduleContains, ver issue #64
describe('scheduleContains — la timezone del argumento manda', () => {
  // Test que prueba que el fix sirve. Si alguien re-implementa la funcion
  // usando Date() del dispositivo (o cualquier fallback silencioso), estos
  // dos casos van a dar el MISMO resultado y el test rompe.
  //
  // El mismo instante UTC evaluado con tz del barrio vs tz del dispositivo
  // "de un guardia de viaje a Tokyo" tiene que dar resultados distintos con
  // la misma ventana: Mza 10:00 esta dentro de 08-12, Tokyo 22:00 no.

  const t = epoch('2026-03-03T13:00:00Z');
  // 2026-03-03 13:00Z:
  //   America/Argentina/Mendoza (UTC-3): martes 10:00
  //   Asia/Tokyo (UTC+9):                martes 22:00

  it('mismo instante en tz del barrio (Mza) esta DENTRO de 08-12 martes', () => {
    const w = window([2], '08:00', '12:00');
    expect(scheduleContains(w, t, MZA)).toBe(true);
  });

  it('mismo instante en tz del dispositivo hipotetico (Tokyo) esta FUERA de 08-12 martes', () => {
    const w = window([2], '08:00', '12:00');
    expect(scheduleContains(w, t, TOKYO)).toBe(false);
  });

  it('el weekday tambien depende del argumento: cerca del cambio de dia', () => {
    // 2026-03-03 22:00Z (martes tarde):
    //   Mendoza (UTC-3): martes 19:00 -> weekday=2 (martes)
    //   Tokyo   (UTC+9): miercoles 07:00 -> weekday=3 (miercoles)
    // Ventana solo martes: en Mza sale true, en Tokyo sale false.
    const w = window([2], '00:00', '23:59');
    const late = epoch('2026-03-03T22:00:00Z');
    expect(scheduleContains(w, late, MZA)).toBe(true);
    expect(scheduleContains(w, late, TOKYO)).toBe(false);
  });
});
