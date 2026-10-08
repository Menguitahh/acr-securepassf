import type { components } from "@securepass/contracts";

import { DNI_PATTERN, FIELD_LABELS } from "@/modules/registry/data";
import type {
  FieldErrors,
  LotInput,
  LotRow,
  LotStatus,
  OnboardInput,
  StatusAction,
  SubmitOutcome,
} from "@/modules/registry/types";

type LotResponse = components["schemas"]["LotResponse"];

// El contrato marca todo opcional (securepassb#196): una fila sin id, codigo
// o estado no se puede mostrar ni accionar, se descarta.
export function toLotRows(lots: readonly LotResponse[]): LotRow[] {
  return lots.flatMap((lot) => {
    if (!lot.id || !lot.code || !lot.status) return [];
    return [{ id: lot.id, code: lot.code, address: formatAddress(lot.street, lot.number), status: lot.status }];
  });
}

export function formatAddress(street: string | undefined, number: string | undefined): string {
  return [street?.trim(), number?.trim()].filter(Boolean).join(" ");
}

export function statusAction(status: LotStatus): StatusAction {
  if (status === "ACTIVE") return { kind: "suspend", label: "Suspender", next: "SUSPENDED" };
  if (status === "SUSPENDED") return { kind: "reactivate", label: "Reactivar", next: "ACTIVE" };
  return { kind: "none" };
}

export function validateLot(input: LotInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.code.trim()) errors.code = "Cargá el código catastral del lote.";
  return errors;
}

export function validateOnboard(input: OnboardInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.fullName.trim()) errors.fullName = "Cargá el nombre completo.";
  if (!DNI_PATTERN.test(input.dni.trim())) errors.dni = "El DNI tiene 7 u 8 números, sin puntos.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = "Cargá un email válido.";
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

// El body del error llega sin tipo en el contrato.
function problemDetail(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("detail" in body)) return null;
  return typeof body.detail === "string" ? body.detail : null;
}

function problemFieldErrors(body: unknown): FieldErrors {
  if (typeof body !== "object" || body === null || !("errors" in body) || !Array.isArray(body.errors)) return {};
  const items: unknown[] = body.errors;
  const errors: FieldErrors = {};
  for (const item of items) {
    if (typeof item !== "object" || item === null || !("field" in item) || typeof item.field !== "string") continue;
    const label = FIELD_LABELS[item.field] ?? item.field;
    errors[item.field] = `${label} inválido. Revisalo y volvé a intentar.`;
  }
  return errors;
}

// Respuesta del backend -> lo que muestra el formulario. `conflict` es el
// mensaje del 409; null usa el detail del server (el alta de usuario explica
// ahi por que no se puede: suspendido, dado de baja, email en uso).
export function toSubmitOutcome(status: number, body: unknown, conflict: string | null): SubmitOutcome {
  if (status >= 200 && status < 300) return { kind: "done" };
  if (status === 400) {
    const fields = problemFieldErrors(body);
    if (hasErrors(fields)) return { kind: "invalid", fields };
  }
  if (status === 409) {
    return { kind: "error", message: conflict ?? problemDetail(body) ?? "Ya existe un registro con esos datos." };
  }
  if (status === 403) return { kind: "error", message: "Tu usuario no tiene permiso para esto. Pedíselo a otro admin del barrio." };
  return { kind: "error", message: "No se pudo guardar. Revisá la conexión y reintentá." };
}
