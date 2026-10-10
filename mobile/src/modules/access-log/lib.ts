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
    return { title: deniedTitle(item), detail, outcome: `Denegado: ${reason}`, denied: true };
  }
  return {
    title: item.subjectName ?? item.passHolderName ?? 'Sin nombre',
    detail,
    outcome: exit ? 'Salió' : 'Entró',
    denied: false,
  };
}

// El QR de un trabajador es su credencial: se nombra igual que el pase de un
// invitado ("el QR de trabajo de Ramon"), no a quien lo presento.
function deniedTitle(item: AccessLogItem): string {
  if (item.passHolderName) return `Se presentó el pase de ${item.passHolderName}`;
  if (item.subjectType === 'SERVICE') {
    return item.subjectName ? `Se presentó el QR de trabajo de ${item.subjectName}` : 'Se presentó un QR de trabajo';
  }
  return 'Se presentó un QR sin pase asociado';
}

// Resumen arriba del Registro del turno: "5 ingresos · 3 egresos · 1 denegado".
// Ingresos y egresos cuentan solo los permitidos.
export function shiftLogSummary(items: readonly AccessLogItem[]): string {
  const ins = items.filter((i) => i.result === 'ALLOWED' && i.direction !== 'OUT').length;
  const outs = items.filter((i) => i.result === 'ALLOWED' && i.direction === 'OUT').length;
  const denied = items.filter((i) => i.result === 'DENIED').length;
  const parts = [
    `${ins} ${ins === 1 ? 'ingreso' : 'ingresos'}`,
    `${outs} ${outs === 1 ? 'egreso' : 'egresos'}`,
  ];
  if (denied > 0) parts.push(`${denied} ${denied === 1 ? 'denegado' : 'denegados'}`);
  return parts.join(' · ');
}
