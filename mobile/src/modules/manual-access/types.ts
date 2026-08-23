import type { components } from '@securepass/contracts';

export type LotSuggestion = components['schemas']['LotAutocompleteResponse'];

export type ManualAccessFormValues = {
  subjectName: string;
  subjectDocument: string;
  // Persistimos ambos para distinguir "lote elegido" de "codigo tipeado":
  // sin lotId no se puede submitear (el endpoint pide uuid).
  lotCode: string;
  lotId: string | null;
};

export type ManualAccessFormResult =
  | { ok: true; payload: components['schemas']['ManualAccessRequest'] }
  | { ok: false; error: string };
