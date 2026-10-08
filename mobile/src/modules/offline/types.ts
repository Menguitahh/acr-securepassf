import type { components } from '@securepass/contracts';

// Motivo de un rechazo decidido en la garita. Mismo vocabulario que
// `reason` del contrato de sync.
export type LocalDenialReason = NonNullable<components['schemas']['Event']['localDenialReason']>;

// Decision local del evento: el motivo existe si y solo si es DENIED,
// igual que lo exige el server.
export type LocalDecision =
  | { localDecision: 'ALLOWED' }
  | { localDecision: 'DENIED'; localDenialReason: LocalDenialReason };

export type OutboxEvent = LocalDecision & {
  clientEventId: string;
  token: string;
  gateId: string | null;
  direction: 'IN' | 'OUT';
  companions: number | null;
  capturedAt: string;
  // DNI capturado offline cuando el server no pudo confirmar el enrolamiento
  // en el momento del scan (#27, US-36). Un evento con documentNumber es
  // a la vez el enrolamiento diferido Y el ingreso registrado — un solo
  // evento, un solo clientEventId. Null en eventos de acceso normales.
  documentNumber: string | null;
};

// Fila de worker_permissions_cache, ya validada desde /access/permissions/sync.
export type WorkerPermissionRow = {
  userId: string;
  jti: string;
  lotId: string;
  lotCode: string;
  weekdays: number[];
  dailyFrom: string;
  dailyUntil: string;
  timezone: string | null;
};

export type WorkerCacheSnapshot = {
  permissions: WorkerPermissionRow[];
  enrolledUserIds: string[];
};
