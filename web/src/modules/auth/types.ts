// admin: administra su barrio. platform (#229): duenio de la plataforma, sin
// barrio propio; elige cual ver (Viewing).
export type SessionUser =
  | {
      kind: "admin";
      id: string;
      fullName: string;
      neighborhoodId: string;
      // IANA, ej. America/Argentina/Mendoza. Todas las horas del dashboard se
      // muestran en la zona del barrio, no en la del navegador.
      neighborhoodTimezone: string;
      roles: string[];
    }
  | { kind: "platform"; id: string; fullName: string; roles: string[] };

// #229: barrio que el duenio de la plataforma esta viendo, en modo lectura.
export type Viewing = { id: string; name: string; timeZone: string };

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export type SignOutReason = "expired" | "notAdmin" | "otherTab" | null;

export type Session =
  | { status: "restoring" }
  | { status: "signedIn"; user: SessionUser }
  | { status: "signedOut"; reason: SignOutReason };

export type LoginResult = { ok: true } | { ok: false; message: string };
