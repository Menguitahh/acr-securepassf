// Fechas civiles del form (YYYY-MM-DD, inclusivas) en la zona del barrio.
export type DateRange = {
  from: string;
  to: string;
};

// Instantes ISO UTC que espera el backend: [from, to).
export type InstantRange = {
  from: string;
  to: string;
};

export type RangeCheck = { ok: true; instants: InstantRange } | { ok: false; message: string };
