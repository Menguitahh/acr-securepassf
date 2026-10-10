// Motivos de denegacion en corto, para una fila de lista. Los mensajes largos
// del scanner (DENIAL_MESSAGES) dicen que hacer; aca solo que paso.
export const DENIAL_LABELS: Record<string, string> = {
  INVALID_SIGNATURE: 'QR no reconocido',
  NOT_YET_VALID: 'Pase todavía no vigente',
  EXPIRED: 'Pase vencido',
  ALREADY_USED: 'Pase ya usado',
  REVOKED: 'Pase revocado',
  OUT_OF_SCHEDULE: 'Fuera de horario',
  LOT_SUSPENDED: 'Lote suspendido',
  REPLAY: 'Copia de un QR ya usado',
  DOCUMENT_MISMATCH: 'El DNI no coincide',
  NOT_ENROLLED: 'Sin verificar el DNI',
  WORKER_NOT_SYNCED: 'Trabajador sin sincronizar',
  NEIGHBORHOOD_TZ_MISSING: 'Barrio sin zona horaria',
  UNKNOWN: 'Motivo desconocido',
};

export const HISTORY_FILTERS: readonly { value: 'ALL' | 'ALLOWED' | 'DENIED'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ALLOWED', label: 'Permitidos' },
  { value: 'DENIED', label: 'Denegados' },
];

// Tamano de pagina de GET /access-logs (ListAccessLogsUseCase.DEFAULT_SIZE).
export const HISTORY_PAGE_SIZE = 25;
