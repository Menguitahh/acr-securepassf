// endedAt null = turno abierto: el guardia sigue en la garita.
export type ShiftRow = {
  id: string;
  gateName: string;
  guardName: string;
  startedAt: string;
  endedAt: string | null;
  accessCount: number;
  handoverNotes: string;
};

export type ShiftPage = {
  rows: ShiftRow[];
  total: number;
  size: number;
};
