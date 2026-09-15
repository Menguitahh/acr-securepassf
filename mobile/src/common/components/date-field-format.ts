export type DateFieldMode = 'date' | 'time' | 'datetime';

export function formatDateFieldValue(
  value: Date | null,
  mode: DateFieldMode,
): string {
  if (!value) return 'Elegir';
  if (mode === 'time') {
    return value.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (mode === 'date') {
    return value.toLocaleDateString('es-AR');
  }
  return value.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
