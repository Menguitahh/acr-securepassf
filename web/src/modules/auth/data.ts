export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const ADMIN_ROLE = "ADMIN";
export const PLATFORM_ROLE = "PLATFORM_ADMIN";

// #229: header con el que el duenio de la plataforma ve un barrio.
export const VIEW_HEADER = "X-Neighborhood-Id";

// Access y user en localStorage (compartidos entre tabs), refresh en
// sessionStorage (muere con el tab). Razon en web/docs/auth.md.
export const ACCESS_TOKEN_KEY = "securepass.access-token";
export const REFRESH_TOKEN_KEY = "securepass.refresh-token";
export const USER_KEY = "securepass.user";
// Barrio elegido por el duenio de la plataforma: por tab, como el refresh.
export const VIEWING_KEY = "securepass.viewing";

export const SIGN_OUT_MESSAGES = {
  expired: "Tu sesión expiró. Ingresá de nuevo para seguir.",
  notAdmin:
    "Esta cuenta no tiene permisos de administrador. Ingresá con una cuenta de administración del barrio.",
  otherTab: "Se cerró la sesión desde otra pestaña. Ingresá de nuevo para seguir.",
} as const;

export const LOGIN_ERRORS = {
  invalidCredentials: "Email o contraseña incorrectos. Revisalos y probá de nuevo.",
  network: "No se pudo conectar con el servidor. Revisá tu conexión y probá de nuevo.",
  server: "El servidor tuvo un error. Probá de nuevo en unos minutos.",
  incompleteSession: "El servidor devolvió una sesión incompleta. Probá de nuevo.",
  storage:
    "El navegador bloqueó el guardado de la sesión. Habilitá el almacenamiento del sitio y probá de nuevo.",
} as const;
