import { pageCount } from "@/common/lib/pagination";

interface Props {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
}

const BUTTON =
  "min-h-12 rounded-md border border-border px-4 font-medium hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-text-primary disabled:opacity-60";

// page arranca en 0, como en el backend; al admin se le muestra desde 1.
export function Pagination({ page, total, size, onChange }: Props) {
  const pages = pageCount(total, size);
  if (pages === 1) return null;
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" disabled={page === 0} onClick={() => onChange(page - 1)} className={BUTTON}>
        Anterior
      </button>
      <span className="tabular-nums text-text-muted">
        Página {page + 1} de {pages}
      </span>
      <button type="button" disabled={page >= pages - 1} onClick={() => onChange(page + 1)} className={BUTTON}>
        Siguiente
      </button>
    </nav>
  );
}
