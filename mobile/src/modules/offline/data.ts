export const SYNC_BATCH_SIZE = 50;

export const SYNC_INTERVAL_MS = 60000;

export const QUEUE_ALERT_THRESHOLD = 500;

// Backoff de spec 8.4: 5 s, 15 s, 60 s, 5 min (tope).
export const BACKOFF_SCHEDULE_MS = [5000, 15000, 60000, 300000];

// Umbral para el prune de huerfanos en el outbox (#83). Filas con
// gateId=null encoladas antes de que el device tenga garita asignada:
// se toleran hasta este limite (setup en progreso), se descartan al
// pasarlo (device rotado, sesion vieja abandonada, garita desasignada).
// 7 dias cubren onboarding humano con fin de semana de por medio. 30 dias
// serian evidencia perdida: si el ingreso no se rescato en un mes, no hay
// contexto para auditarlo. Ver issue #83 para el analisis completo.
export const PRUNE_NULL_GATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
