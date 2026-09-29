// Tamano fijo de pagina de /access-logs y /shifts (securepassb#209): el
// backend no acepta size. Solo es respaldo si la respuesta no trae size.
export const BACKEND_PAGE_SIZE = 25;

// Sin filas hay una pagina (vacia), no cero.
export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}
