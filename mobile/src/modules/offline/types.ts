export type OutboxEvent = {
  clientEventId: string;
  token: string;
  gateId: string | null;
  direction: 'IN' | 'OUT';
  companions: number | null;
  capturedAt: string;
  localDecision: 'ALLOWED' | 'DENIED';
  // DNI capturado offline cuando el server no pudo confirmar el enrolamiento
  // en el momento del scan (#27, US-36). Un evento con documentNumber es
  // a la vez el enrolamiento diferido Y el ingreso registrado — un solo
  // evento, un solo clientEventId. Null en eventos de acceso normales.
  documentNumber: string | null;
};
