import type { components } from '@securepass/contracts';

export type AccessLogItem = components['schemas']['AccessLogItem'];

// Lo que muestra una fila del registro (US-72) o del historial (US-26).
export type AccessLogRowText = {
  title: string;
  detail: string;
  outcome: string;
  denied: boolean;
};

// US-26: filtro del historial del residente.
export type HistoryFilter = 'ALL' | 'ALLOWED' | 'DENIED';
