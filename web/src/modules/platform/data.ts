// Zonas IANA de Argentina para el horario del barrio. La garita y el
// dashboard muestran las horas en esta zona.
export const TIMEZONES = [
  { value: "America/Argentina/Mendoza", label: "Mendoza" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/Argentina/Cordoba", label: "Córdoba" },
  { value: "America/Argentina/Salta", label: "Salta" },
  { value: "America/Argentina/Jujuy", label: "Jujuy" },
  { value: "America/Argentina/Tucuman", label: "Tucumán" },
  { value: "America/Argentina/Catamarca", label: "Catamarca" },
  { value: "America/Argentina/La_Rioja", label: "La Rioja" },
  { value: "America/Argentina/San_Juan", label: "San Juan" },
  { value: "America/Argentina/San_Luis", label: "San Luis" },
  { value: "America/Argentina/Rio_Gallegos", label: "Santa Cruz" },
  { value: "America/Argentina/Ushuaia", label: "Tierra del Fuego" },
] as const;

export const DEFAULT_TIMEZONE = "America/Argentina/Mendoza";

export const ADMIN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  PENDING_ACTIVATION: "Pendiente de activación",
  SUSPENDED: "Suspendida",
};

export const CONFLICT_MESSAGES: Record<string, string> = {
  SLUG_TAKEN: "Ya hay un barrio con ese identificador. Elegí otro.",
  NAME_TAKEN: "Ya hay un barrio con ese nombre. Elegí otro.",
  EMAIL_TAKEN: "Ese email ya tiene cuenta en Securepass. Usá otro para el admin.",
  DNI_TAKEN: "Ese DNI ya tiene cuenta en Securepass. Revisalo.",
};
