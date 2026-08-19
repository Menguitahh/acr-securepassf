export type OutboxEvent = {
  clientEventId: string;
  token: string;
  gateId: string | null;
  direction: 'IN' | 'OUT';
  companions: number | null;
  capturedAt: string;
  localDecision: 'ALLOWED' | 'DENIED';
};
