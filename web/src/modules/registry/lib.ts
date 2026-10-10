import type { components } from "@securepass/contracts";

import { DNI_PATTERN, FIELD_LABELS, IMPORT_COLUMNS, ROLE_LABELS } from "@/modules/registry/data";
import type {
  FieldErrors,
  ImportPreview,
  ImportPreviewRow,
  LotInput,
  LotRow,
  LotStatus,
  OnboardInput,
  StatusAction,
  SubmitOutcome,
} from "@/modules/registry/types";

type LotResponse = components["schemas"]["LotResponse"];

export function toLotRows(lots: readonly LotResponse[]): LotRow[] {
  return lots.map((lot) => ({
    id: lot.id,
    code: lot.code,
    address: formatAddress(lot.street, lot.number),
    status: lot.status,
  }));
}

// street y number son nullable (securepassb#196): un lote sin direccion.
export function formatAddress(street: string | null, number: string | null): string {
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

// US-09 (#214): CSV de una hoja de calculo. Excel en es-AR exporta con ";",
// Google Sheets con ",": el separador sale de la primera linea. Comillas
// dobles para campos con separador o salto de linea ("" es una comilla).
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^\uFEFF/, "");
  const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

// Valida cada fila sin cortar en la primera: el admin ve todo lo que hay que
// corregir antes de confirmar. existing: codigos que ya estan en el barrio
// (el lote no se crea de nuevo; si trae titular, se le suma).
export function toImportPreview(text: string, existing: ReadonlySet<string>): ImportPreview {
  const [header, ...data] = parseCsv(text);
  if (!header) return { kind: "error", message: "El archivo está vacío." };
  const columns = header.map(normalizeHeader);
  const index = (name: (typeof IMPORT_COLUMNS)[number]) => columns.indexOf(name);
  if (index("codigo") === -1) {
    return { kind: "error", message: `Falta la columna codigo. La primera fila tiene que ser: ${IMPORT_COLUMNS.join(",")}` };
  }
  if (!data.length) return { kind: "error", message: "El archivo no tiene filas debajo del encabezado." };

  const seen = new Set<string>();
  const rows: ImportPreviewRow[] = data.map((cells, i) => {
    const line = i + 2;
    const cell = (name: (typeof IMPORT_COLUMNS)[number]) => {
      const at = index(name);
      return at === -1 ? "" : (cells[at] ?? "").trim();
    };
    const code = cell("codigo");
    if (!code) return { line, status: "invalid", code, message: "Falta el código del lote." };
    const key = code.toUpperCase();
    if (seen.has(key)) return { line, status: "invalid", code, message: "El código se repite en el archivo." };
    seen.add(key);

    const owner = { fullName: cell("titular_nombre"), dni: cell("titular_dni"), email: cell("titular_email") };
    const ownerFields = [owner.fullName, owner.dni, owner.email].filter(Boolean).length;
    if (ownerFields > 0 && ownerFields < 3) {
      return { line, status: "invalid", code, message: "El titular va completo: nombre, DNI y email, o ninguno." };
    }
    if (ownerFields === 3) {
      const errors = validateOnboard(owner);
      const first = Object.values(errors)[0];
      if (first) return { line, status: "invalid", code, message: first };
    }
    return {
      line,
      status: "ready",
      lotExists: existing.has(key),
      row: { line, code, street: cell("calle"), number: cell("numero"), owner: ownerFields === 3 ? owner : null },
    };
  });
  return { kind: "ok", rows };
}

// US-54: como se presenta una cuenta pendiente. Sin rol de barrio y con
// lotes es un trabajador.
export function describePending(roles: readonly string[], lotCodes: readonly string[]): string {
  const roleText = roles.map((role) => ROLE_LABELS[role] ?? role).join(", ") || "Trabajador";
  return lotCodes.length ? `${roleText} · ${lotCodes.join(", ")}` : roleText;
}

// US-54: respuesta de POST /admin/users/{id}/resend-activation. null = enviado.
export function resendActivationError(status: number): string | null {
  if (status === 204) return null;
  if (status === 429) return "Ya le reenviaste el correo 3 veces en la última hora. Esperá un rato.";
  if (status === 409) return "Esa cuenta ya está activa.";
  if (status === 404) return "Esa cuenta ya no está en el barrio.";
  return "No se pudo reenviar el correo. Revisá la conexión y reintentá.";
}
