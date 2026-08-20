export type ProblemDetail = {
  status: number;
  type?: string;
  title?: string;
  detail?: string;
  rule?: string;
};

export function isProblemDetail(value: unknown): value is ProblemDetail {
  if (typeof value !== 'object' || value === null) return false;
  if (!('status' in value) || typeof value.status !== 'number') return false;
  return true;
}
