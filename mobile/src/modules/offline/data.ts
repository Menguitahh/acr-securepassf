export const SYNC_BATCH_SIZE = 50;

export const SYNC_INTERVAL_MS = 60000;

export const QUEUE_ALERT_THRESHOLD = 500;

// Backoff de spec 8.4: 5 s, 15 s, 60 s, 5 min (tope).
export const BACKOFF_SCHEDULE_MS = [5000, 15000, 60000, 300000];
