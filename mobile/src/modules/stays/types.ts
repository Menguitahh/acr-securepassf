import type { components } from '@securepass/contracts';

export type Stay = components['schemas']['OpenStay'];

// Aviso local de este dispositivo para una estadia. fireAt null = fila
// anterior a la migracion de #31: se deriva de expectedUntil.
export type LocalWarning = {
  fireAt: number | null;
  synced: boolean;
};
