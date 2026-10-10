import type { LotStatus } from "@/modules/registry/types";

// Tamano de pagina fijo de GET /admin/lots (ListLotsUseCase.PAGE_SIZE).
export const LOTS_PAGE_SIZE = 50;

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  VACANT: "Vacante",
};

// Nombres de los campos del backend -> etiqueta del formulario, para los
// errores de validacion que no traen un mensaje propio del front.
export const FIELD_LABELS: Record<string, string> = {
  code: "Código",
  street: "Calle",
  number: "Número",
  fullName: "Nombre completo",
  dni: "DNI",
  email: "Email",
};

export const DNI_PATTERN = /^\d{7,8}$/;

// US-09 (#214): columnas del CSV del padron. codigo es la unica obligatoria;
// el titular va completo (nombre, DNI y email) o no va.
export const IMPORT_COLUMNS = ["codigo", "calle", "numero", "titular_nombre", "titular_dni", "titular_email"] as const;

export const IMPORT_TEMPLATE = `${IMPORT_COLUMNS.join(",")}\nA-101,Los Robles,101,Ana Gomez,30111222,ana@ejemplo.com\nA-102,Los Robles,102,,,`;

// US-54: rol de la cuenta pendiente, para la tabla.
export const ROLE_LABELS: Record<string, string> = {
  RESIDENT_OWNER: "Titular",
  RESIDENT_MEMBER: "Familiar",
  GUARD: "Guardia",
  ADMIN: "Admin",
};
