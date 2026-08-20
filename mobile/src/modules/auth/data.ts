export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// Etiquetas de rol para UI. La union de roles del backend es cerrada
// (memberships.role), pero el session user guarda string[] para no
// acoplarse a cada rol nuevo: el fallback muestra el valor crudo.
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  GUARD: 'Guardia',
  RESIDENT_OWNER: 'Titular',
  RESIDENT_MEMBER: 'Familiar',
};
