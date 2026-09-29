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

export const DAY_ERRORS = {
  missing: "Elegí un día.",
  future: "Elegí hoy o un día anterior.",
} as const;
