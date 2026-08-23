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
    },
  };
}
