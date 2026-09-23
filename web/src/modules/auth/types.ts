export type SessionUser = {
  id: string;
  fullName: string;
  neighborhoodId: string;
  roles: string[];
};

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
