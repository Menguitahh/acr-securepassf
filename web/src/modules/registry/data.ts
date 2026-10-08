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
