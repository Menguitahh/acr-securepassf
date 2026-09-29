import type { DenialReason } from "@/common/denials/types";

// Etiquetas de bucket para el admin, no las acciones que lee el guardia en
// mobile. Duplicacion deliberada: ver #127. `satisfies` rompe tsc si el
// backend agrega un motivo y aca falta.
export const DENIAL_LABELS = {
  INVALID_SIGNATURE: "Firma inválida",
  NOT_YET_VALID: "Pase todavía no vigente",
  EXPIRED: "Pase vencido",
  ALREADY_USED: "Pase ya usado",
  REVOKED: "Pase revocado",
  OUT_OF_SCHEDULE: "Fuera de horario",
  LOT_SUSPENDED: "Lote suspendido",
  // No es un evento sincronizado dos veces (eso es idempotente y queda
  // permitido): es el mismo uso del pase reclamado por dos escaneos.
  REPLAY: "Pase usado dos veces",
  DOCUMENT_MISMATCH: "Documento no coincide",
  UNKNOWN: "Motivo desconocido",
} as const satisfies Record<DenialReason, string>;
