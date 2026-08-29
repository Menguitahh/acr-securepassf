/**
 * WBS-113: calculo de edad usado por la pantalla de familia para ramificar
 * el formulario entre "alta de familiar" (>=16, va a /members) y "alta de
 * menor" (<16, va a /minors).
 *
 * Regla acordada con el backend: **el dia del cumpleanios 16 la persona ya
 * es mayor**. La logica espeja `java.time.Period.between(...).getYears()`,
 * que backend usa en AddFamilyMemberUseCase.MIN_AGE y en
 * RegisterMinorUseCase.MAX_AGE. Si el cliente calcula distinto, la UI
 * muestra un formulario y el server rechaza — bug de sync.
 *
 * Trabaja en calendario local (no UTC), porque el titular piensa en fechas
 * de calendario, no en instantes. birthDate viene del datepicker como
 * string 'YYYY-MM-DD' (formato del contrato); today se toma del reloj
 * local del dispositivo salvo que el caller lo inyecte (usado en tests).
 */
export function computeAgeYears(birthDate: string, today: Date = new Date()): number {
  const parsed = parseYmd(birthDate);
  if (!parsed) {
    throw new Error(`birthDate invalida: ${birthDate}`);
  }
  const { y: by, m: bm, d: bd } = parsed;
  // Calendario local del dispositivo. Usar getUTC* aca daria un dia
  // distinto si el reloj esta cerca de medianoche y el usuario esta en
  // TZ negativa/positiva — cambio de dia falso, cambio de anios falso.
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();

  let years = ty - by;
  // Si todavia no cumplio en este anio, restar uno.
  // Regla "cumpleanios = mayor" -> comparacion estricta:
  //   today < birthday-in-this-year  => aun no cumplio
  //   today == birthday-in-this-year => ya cumplio (mayor ese mismo dia)
  if (tm < bm || (tm === bm && td < bd)) {
    years -= 1;
  }
  return years;
}

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}
