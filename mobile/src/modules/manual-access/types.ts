import type { components } from '@securepass/contracts';

export type LotSuggestion = components['schemas']['LotAutocompleteResponse'];

export type ManualAccessFormValues = {
  subjectName: string;
  subjectDocument: string;
  // Persistimos ambos para distinguir "lote elegido" de "codigo tipeado":
  // sin lotId no se puede submitear (el endpoint pide uuid).
  lotCode: string;
  lotId: string | null;
  // US-24 / WBS-36: acompanantes de la visita imprevista, 0..10.
  companions: number;
};

export type ManualAccessRequest = components['schemas']['ManualAccessRequest'];

// WBS-36: resultado del registro. Sin red queda en la cola y se reenvia.
export type ManualAccessOutcome =
  | { kind: 'sent'; subjectName: string; subjectDocument: string }
  | { kind: 'queued'; subjectName: string; subjectDocument: string };

export type ManualAccessFormResult =
  | { ok: true; payload: components['schemas']['ManualAccessRequest'] }
  | { ok: false; error: string };
