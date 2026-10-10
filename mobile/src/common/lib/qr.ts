// #233: lado del QR segun el ancho de la pantalla. 24 dp de margen de la
// pantalla y 24 dp de zona de silencio de cada lado; entre 200 y 280 dp.
const SCREEN_PADDING = 24;
const QUIET_ZONE = 24;
const MIN = 200;
const MAX = 280;

export function qrSize(screenWidth: number): number {
  const available = screenWidth - 2 * SCREEN_PADDING - 2 * QUIET_ZONE;
  return Math.max(MIN, Math.min(MAX, Math.floor(available)));
}
