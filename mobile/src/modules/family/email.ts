// Sanity check estructural. Rechaza los typos que rompen el shape del
// email (sin arroba, sin TLD, TLD de 1 char, espacios). NO rechaza
// typos plausibles como "luciano@dsad.copm" — `.copm` es sintacticamente
// un TLD valido. El fix real de typos silenciosos es feedback de bounce
// del mailer server-side (#95, tracked aparte en el backend).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}
