import type {
  NeighborhoodCheckDeps,
  NeighborhoodCheckOutcome,
} from '@/modules/auth/types';

// #121: la SQLite local (claves, revocaciones, enrolamientos, outbox) es de
// la garita y sobrevive al logout. Si el dispositivo pasa a otro barrio,
// esa data no puede quedar mezclada con la del nuevo: se borra completa.
// No hay "reasignar sin borrar". Con eventos sin sincronizar, el guardia
// decide con el conteo a la vista: no se pueden mandar a otro barrio.
export async function resolveNeighborhoodSwitch(
  neighborhoodId: string,
  deps: NeighborhoodCheckDeps,
): Promise<NeighborhoodCheckOutcome> {
  const last = await deps.loadLastNeighborhood();
  if (last === neighborhoodId) return 'continue';

  if (last !== null) {
    const pending = deps.countPending();
    if (pending > 0 && (await deps.promptReassign(pending)) === 'cancel') return 'cancelled';
    deps.wipeLocalDatabase();
  }
  await deps.saveLastNeighborhood(neighborhoodId);
  return 'continue';
}
