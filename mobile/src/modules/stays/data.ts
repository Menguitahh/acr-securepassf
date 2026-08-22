// Cuando faltan menos de este umbral (o el server ya marco warned=true),
// la fila se resalta para llamar la atencion del guardia.
export const NEAR_EXPIRY_MINUTES = 30;

export const STAYS_REFRESH_MS = 60_000;

// BR-15: notificacion local 20 min antes del vencimiento esperado.
export const WARNING_LEAD_MINUTES = 20;
