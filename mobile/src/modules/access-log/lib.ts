import { DENIAL_LABELS } from '@/modules/access-log/data';
import type { AccessLogItem, AccessLogRowText } from '@/modules/access-log/types';

// Hora y, si no es de hoy, la fecha: "14:32" o "9/10 14:32".
export function formatLogTime(iso: string | undefined, now: Date): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const time = at.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const sameDay = at.toDateString() === now.toDateString();
  return sameDay ? time : `${at.getDate()}/${at.getMonth() + 1} ${time}`;
}

// Una fila del registro. El denegado no dice quien entro ni quien lo intento:
// el log prueba que pase se presento, no quien lo presento (#210, #214). Por
// eso nombra el pase ("Se presento el pase de Ana") y no a la persona.
export function describeAccessLog(item: AccessLogItem): AccessLogRowText {
  const exit = item.direction === 'OUT';
  const lot = item.lotCode ? ` · Lote ${item.lotCode}` : '';
  const detail = `${exit ? 'Egreso' : 'Ingreso'}${lot}`;
  if (item.result === 'DENIED') {
    const reason = DENIAL_LABELS[item.denialReason ?? 'UNKNOWN'] ?? DENIAL_LABELS.UNKNOWN ?? '';
    const title = item.passHolderName
      ? `Se presentó el pase de ${item.passHolderName}`
      : 'Se presentó un QR sin pase asociado';
    return { title, detail, outcome: `Denegado: ${reason}`, denied: true };
  }
  return {
    title: item.subjectName ?? item.passHolderName ?? 'Sin nombre',
    detail,
    outcome: exit ? 'Salió' : 'Entró',
    denied: false,
  };
}
