import { describe, expect, it, vi } from 'vitest';

import { resolveNeighborhoodSwitch } from '@/modules/auth/reassign';
import type { NeighborhoodCheckDeps } from '@/modules/auth/types';

function deps(last: string | null, overrides: Partial<NeighborhoodCheckDeps> = {}) {
  return {
    loadLastNeighborhood: vi.fn().mockResolvedValue(last),
    saveLastNeighborhood: vi.fn().mockResolvedValue(undefined),
    countPending: vi.fn().mockReturnValue(0),
    wipeLocalDatabase: vi.fn(),
    promptReassign: vi.fn().mockResolvedValue('reassign'),
    ...overrides,
  };
}

describe('resolveNeighborhoodSwitch', () => {
  it('primer login en el dispositivo: guarda el barrio sin borrar nada', async () => {
    const d = deps(null);
    expect(await resolveNeighborhoodSwitch('barrio-a', d)).toBe('continue');
    expect(d.wipeLocalDatabase).not.toHaveBeenCalled();
    expect(d.saveLastNeighborhood).toHaveBeenCalledWith('barrio-a');
  });

  it('mismo barrio: no toca la base ni pregunta', async () => {
    const d = deps('barrio-a', { countPending: vi.fn().mockReturnValue(5) });
    expect(await resolveNeighborhoodSwitch('barrio-a', d)).toBe('continue');
    expect(d.wipeLocalDatabase).not.toHaveBeenCalled();
    expect(d.promptReassign).not.toHaveBeenCalled();
  });

  it('otro barrio con outbox vacio: borra la base sin preguntar', async () => {
    const d = deps('barrio-a');
    expect(await resolveNeighborhoodSwitch('barrio-b', d)).toBe('continue');
    expect(d.promptReassign).not.toHaveBeenCalled();
    expect(d.wipeLocalDatabase).toHaveBeenCalledTimes(1);
    expect(d.saveLastNeighborhood).toHaveBeenCalledWith('barrio-b');
  });

  it('otro barrio con pendientes y el guardia reasigna: pregunta con el conteo y borra', async () => {
    const d = deps('barrio-a', { countPending: vi.fn().mockReturnValue(3) });
    expect(await resolveNeighborhoodSwitch('barrio-b', d)).toBe('continue');
    expect(d.promptReassign).toHaveBeenCalledWith(3);
    expect(d.wipeLocalDatabase).toHaveBeenCalledTimes(1);
    expect(d.saveLastNeighborhood).toHaveBeenCalledWith('barrio-b');
  });

  it('otro barrio con pendientes y el guardia cancela: no borra ni cambia el barrio', async () => {
    const d = deps('barrio-a', {
      countPending: vi.fn().mockReturnValue(3),
      promptReassign: vi.fn().mockResolvedValue('cancel'),
    });
    expect(await resolveNeighborhoodSwitch('barrio-b', d)).toBe('cancelled');
    expect(d.wipeLocalDatabase).not.toHaveBeenCalled();
    expect(d.saveLastNeighborhood).not.toHaveBeenCalled();
  });
});
