import { CONFLICT_MESSAGES } from "@/modules/platform/data";
import type { CreateOutcome, NewNeighborhoodErrors, NewNeighborhoodInput } from "@/modules/platform/types";

const SLUG = /^[a-z0-9-]+$/;
const DNI = /^\d{7,8}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Identificador del barrio a partir del nombre: "Los Álamos 2" -> "los-alamos-2".
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function validateNewNeighborhood(input: NewNeighborhoodInput): NewNeighborhoodErrors {
  const errors: NewNeighborhoodErrors = {};
  if (!input.name.trim()) errors.name = "Poné el nombre del barrio.";
  if (!SLUG.test(input.slug)) errors.slug = "Usá minúsculas, números y guiones.";
  if (!input.adminFullName.trim()) errors.adminFullName = "Poné el nombre del admin.";
  if (!DNI.test(input.adminDni.trim())) errors.adminDni = "El DNI va de 7 a 8 dígitos.";
  if (!EMAIL.test(input.adminEmail.trim())) errors.adminEmail = "Revisá el email del admin.";
  return errors;
}

// Respuesta de POST /platform/neighborhoods.
export function toCreateOutcome(status: number, body: unknown, neighborhoodId: string | null): CreateOutcome {
  if (status === 201 && neighborhoodId) return { kind: "done", neighborhoodId };
  if (status === 409 && typeof body === "object" && body !== null && "code" in body && typeof body.code === "string") {
    return { kind: "error", message: CONFLICT_MESSAGES[body.code] ?? "Ya existe un barrio con esos datos." };
  }
  if (status === 400) return { kind: "error", message: "Revisá los datos del formulario y volvé a intentar." };
  return { kind: "error", message: "No se pudo crear el barrio. Revisá la conexión y reintentá." };
}
