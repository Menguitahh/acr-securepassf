import { describe, expect, it } from 'vitest';

import { computeAgeYears } from '@/modules/family/age';

// Regla acordada con backend: cumpleanios 16 = mayor (mismo criterio que
// java.time.Period.between(...).getYears()). Estos tests fijan la regla
// para que el cliente ramifique EXACTAMENTE como el server valida — si
// alguno se desincroniza, la UI muestra un formulario que el server
// rechaza.

describe('computeAgeYears', () => {
  it('dia exacto del cumpleanios 16 -> 16 (mayor)', () => {
    // Nacido 2010-06-29. Hoy 2026-06-29 exacto.
    const today = localDate(2026, 6, 29);
    expect(computeAgeYears('2010-06-29', today)).toBe(16);
  });

  it('un dia antes del cumpleanios 16 -> 15 (menor)', () => {
    const today = localDate(2026, 6, 28);
    expect(computeAgeYears('2010-06-29', today)).toBe(15);
  });

  it('un dia despues del cumpleanios 16 -> 16', () => {
    const today = localDate(2026, 6, 30);
    expect(computeAgeYears('2010-06-29', today)).toBe(16);
  });

  it('nacido el 29-feb: cumple 16 el 29-feb del anio bisiesto siguiente', () => {
    // Nacido 2008-02-29. Cumple 16 en 2024 (bisiesto). El 2024-02-29 ya
    // tiene 16; el 2024-02-28 todavia 15 (aun no llego a la fecha en el
    // calendario, mismo criterio que Java Period).
    expect(computeAgeYears('2008-02-29', localDate(2024, 2, 28))).toBe(15);
    expect(computeAgeYears('2008-02-29', localDate(2024, 2, 29))).toBe(16);
    expect(computeAgeYears('2008-02-29', localDate(2024, 3, 1))).toBe(16);
  });

  it('nacido 29-feb: en anio NO bisiesto el hito lo cruza el 1-mar', () => {
    // 2010-02-29 no existe: nacido 2008-02-29 en 2025 (no bisiesto) todavia
    // tiene 16 el 2025-02-28 (a los 17 llega el 2025-02-29 -> normaliza a
    // 2025-03-01). Comparacion mes/dia: today(2,28) < birth(2,29) => resta
    // uno del diff de anios (17 - 1 = 16). Correcto.
    expect(computeAgeYears('2008-02-29', localDate(2025, 2, 28))).toBe(16);
    expect(computeAgeYears('2008-02-29', localDate(2025, 3, 1))).toBe(17);
  });

  it('usa calendario LOCAL, no UTC (evita off-by-one por TZ)', () => {
    // Un Date con timestamp UTC de las 02:00Z equivale a distintos dias en
    // TZ distintas. En Argentina (UTC-3) el instant '2026-06-29T02:00:00Z'
    // es '2026-06-28 23:00 local'; en Nueva Zelanda (UTC+13) es
    // '2026-06-29 15:00 local'. computeAgeYears usa el calendario LOCAL
    // del `today` (o sea, del Date pasado), no UTC — esto matchea el
    // instante que el usuario ve en el datepicker.
    //
    // Aca no podemos cambiar la TZ del proceso; testeamos que la funcion
    // usa getFullYear/getMonth/getDate (locales) construyendo el Date con
    // constructor local. Ver localDate() abajo: fabrica un Date cuyo
    // getFullYear/etc devuelven exactamente los numeros que le pasamos,
    // independientemente de la TZ del proceso que corre el test.
    const today = localDate(2026, 6, 29);
    expect(today.getFullYear()).toBe(2026);
    expect(today.getMonth() + 1).toBe(6);
    expect(today.getDate()).toBe(29);
    expect(computeAgeYears('2010-06-29', today)).toBe(16);
  });

  it('rechaza birthDate mal formada', () => {
    expect(() => computeAgeYears('29/06/2010')).toThrow();
    expect(() => computeAgeYears('')).toThrow();
    expect(() => computeAgeYears('2010-13-01')).toThrow();
  });
});

// Fabrica un Date cuyos getters locales (getFullYear, getMonth, getDate)
// devuelven los numeros pasados. `new Date(y, mIndex, d)` construye en
// zona local por definicion, asi que independentiza el test de la TZ del
// entorno que lo corre (CI usa UTC, dev puede ser cualquiera).
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}
