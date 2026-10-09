import type { components } from "@securepass/contracts";

export type LotStatus = NonNullable<components["schemas"]["LotResponse"]["status"]>;

export type LotRow = {
  id: string;
  code: string;
  address: string;
  status: LotStatus;
};

// La accion de estado que se ofrece para cada lote. Un lote vacante no tiene
// a quien suspender: no ofrece accion.
export type StatusAction =
  | { kind: "suspend"; label: string; next: "SUSPENDED" }
  | { kind: "reactivate"; label: string; next: "ACTIVE" }
  | { kind: "none" };

export type LotInput = {
  code: string;
  street: string;
  number: string;
};

export type OnboardRole = "RESIDENT_OWNER" | "GUARD";

export type OnboardInput = {
  fullName: string;
  dni: string;
  email: string;
};

// Errores por campo para mostrar al lado de cada input.
export type FieldErrors = Partial<Record<string, string>>;

// Resultado de un submit contra el backend: listo, o errores para mostrar.
export type SubmitOutcome =
  | { kind: "done" }
  | { kind: "invalid"; fields: FieldErrors }
  | { kind: "error"; message: string };

// US-09 (#214): import del padron desde CSV. Una fila es un lote y, si trae
// los tres datos, su titular.
export type ImportRow = {
  line: number;
  code: string;
  street: string;
  number: string;
  owner: OnboardInput | null;
};

export type ImportPreviewRow =
  | { line: number; status: "ready"; row: ImportRow; lotExists: boolean }
  | { line: number; status: "invalid"; code: string; message: string };

export type ImportPreview =
  | { kind: "ok"; rows: ImportPreviewRow[] }
  | { kind: "error"; message: string };

export type ImportResultRow = { line: number; code: string; ok: boolean; message: string };
