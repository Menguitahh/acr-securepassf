// Mismas palabras que el Excel de la bitacora (AccessLogXlsxSheet en
// securepassb): el admin lee lo mismo en pantalla y en el archivo.
export const SUBJECT_TYPE_LABELS: Record<string, string> = {
  GUEST: "Invitado",
  RESIDENT: "Residente",
  SERVICE: "Servicio",
  MANUAL: "Manual",
};

export const DIRECTION_LABELS: Record<string, string> = {
  IN: "Ingreso",
  OUT: "Egreso",
};

// #164: un denegado no prueba quien se presento, prueba que pase. Sin
// titular, la firma invalida o el pase inexistente no se pueden atribuir;
// cualquier otro motivo es una fila de antes de securepassb#210, cuando el
// pase se conocia pero no se guardaba el vinculo.
export const UNIDENTIFIABLE_REASONS: readonly string[] = ["INVALID_SIGNATURE", "UNKNOWN"];

export const PASS_LABELS = {
  holder: "Pase de: ",
  unidentifiable: "No identificable",
  unrecorded: "Pase sin registrar",
} as const;

export const DAY_ERRORS = {
  missing: "Elegí un día.",
  future: "Elegí hoy o un día anterior.",
} as const;
