// #233: estado del pase que se muestra junto al QR, sin datos personales.
export type PassValidity =
  | { kind: 'valid'; label: string }
  | { kind: 'upcoming'; label: string }
  | { kind: 'expired'; label: string };
