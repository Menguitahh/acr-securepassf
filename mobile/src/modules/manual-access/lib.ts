import type {
  ManualAccessFormResult,
  ManualAccessFormValues,
} from '@/modules/manual-access/types';

// Mismo criterio que WBS-64 en invitaciones: puntos, espacios y guiones
// se sacan antes de validar. El backend valida 7-8 digitos igual.
function normalizeDocument(raw: string): string {
  return raw.replace(/[.\s-]/g, '');
}

export function validateManualAccess(
  values: ManualAccessFormValues,
  gateId: string | null,
  clientEventId: string,
): ManualAccessFormResult {
  if (!gateId) {
    return { ok: false, error: 'Falta la garita configurada en este dispositivo.' };
  }
  const subjectName = values.subjectName.trim();
  if (!subjectName) return { ok: false, error: 'Poné el nombre de quien ingresa.' };

  const subjectDocument = normalizeDocument(values.subjectDocument);
  if (!subjectDocument) return { ok: false, error: 'Poné el DNI de quien ingresa.' };
  if (!/^\d{7,8}$/.test(subjectDocument)) {
    return { ok: false, error: 'El DNI va de 7 a 8 digitos.' };
  }

  if (!values.lotId) {
    return { ok: false, error: 'Elegí un lote del listado.' };
  }

  return {
    ok: true,
    payload: {
      subjectName,
      subjectDocument,
      lotId: values.lotId,
      gateId,
      clientEventId,
      capturedAt: new Date().toISOString(),
      companions: values.companions,
    },
  };
}

// WBS-36: el autocompletado filtra la lista de lotes guardada en el telefono,
// asi funciona sin red. Prefijo del codigo, sin mayusculas, hasta 10.
export function filterLots<T extends { code?: string }>(lots: readonly T[], query: string): T[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  return lots.filter((lot) => (lot.code ?? '').toUpperCase().startsWith(q)).slice(0, 10);
}

// Lista de lotes guardada: lo de otra version de la app se descarta.
export function parseStoredLots(value: unknown): { id: string; code: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: unknown[] = value;
  const lots: { id: string; code: string }[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) return undefined;
    const id: unknown = Reflect.get(item, 'id');
    const code: unknown = Reflect.get(item, 'code');
    if (typeof id !== 'string' || typeof code !== 'string') return undefined;
    lots.push({ id, code });
  }
  return lots;
}
