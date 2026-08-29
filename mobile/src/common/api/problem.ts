/**
 * ProblemDetail alineado con RFC 7807 + los props custom que agregan los
 * ExceptionHandlers del backend.
 *
 * OJO: este tipo es exclusivamente para RESPUESTAS DE ERROR. Los
 * `outcome`/`revokedInvitationsCount` que devuelven los endpoints en 200/201
 * NO viven aca — viven en `components['schemas'][...]` (openapi.d.ts) y se
 * consumen tipando la respuesta success del hook. Mezclarlos aca produciria
 * un tipo que confunde exito y error, y forzaria a chequear `status` para
 * saber que campos leer.
 */
export type ProblemDetail = {
  status: number;
  type?: string;
  title?: string;
  detail?: string;

  /** Rule id para 422 (BusinessRuleViolationException). */
  rule?: string;

  /** Code discriminador que agregan varios handlers del back:
   *   - AGE_UNDER_16 / AGE_OVER_16 (edad fuera de rango del endpoint)
   *   - EMAIL_REQUIRED
   *   - USER_SUSPENDED / USER_DELETED (UserOnboardingConflictException)
   *   - EMAIL_TAKEN / PENDING_ACTIVATION_EXISTS / DNI_TAKEN
   *   - NEIGHBORHOOD_NOT_PROVISIONED
   */
  code?: string;

  /** Solo con AGE_UNDER_16 / AGE_OVER_16. */
  minAge?: number;
  maxAge?: number;

  /** Solo con AGE_UNDER_16 / AGE_OVER_16: endpoint sugerido para el otro
   *  flujo. Ej: alta de familiar con edad < 16 devuelve
   *  '/api/v1/family/lots/{lotId}/minors'. */
  redirectTo?: string;

  /** Solo con USER_SUSPENDED / USER_DELETED / EMAIL_TAKEN / DNI_TAKEN /
   *  PENDING_ACTIVATION_EXISTS: el user existente en el sistema. Uso
   *  informativo para el titular ("contactar a la administracion"); no
   *  hay flujo autoservicio para desuspender. */
  existingUserId?: string;

  /** Solo con NEIGHBORHOOD_NOT_PROVISIONED: recurso faltante en el barrio. */
  neighborhoodId?: string;
  missing?: string;
};

export function isProblemDetail(value: unknown): value is ProblemDetail {
  if (typeof value !== 'object' || value === null) return false;
  if (!('status' in value) || typeof (value as { status: unknown }).status !== 'number') return false;
  return true;
}

/**
 * Extrae el `code` cuando existe. Helper para la ramificacion de UI
 * (mostrar mensaje distinto segun AGE_UNDER_16 / USER_SUSPENDED / etc)
 * sin repetir el narrowing en cada caller.
 */
export function problemCode(value: unknown): string | undefined {
  if (!isProblemDetail(value)) return undefined;
  return value.code;
}
