export type DeniedLogRow = {
  id: string;
  capturedAt: string;
  subjectName: string;
  subjectDocument: string;
  lotCode: string;
  subjectType: string;
  direction: string;
};

export type DeniedLogPage = {
  rows: DeniedLogRow[];
  total: number;
  size: number;
};

// Dia elegido, validado y convertido a la ventana que usan los dos
// endpoints: [medianoche del barrio, medianoche siguiente).
export type DayCheck = { ok: true; from: string; to: string } | { ok: false; message: string };
