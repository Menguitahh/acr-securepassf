import type { components } from '@securepass/contracts';

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatWindow(from?: string, until?: string): string {
  if (!from || !until) return 'Sin ventana';
  return `${formatDateTime(from)} - ${formatDateTime(until)}`;
}

export function remainingUses(
  invitation: components['schemas']['InvitationResponse'],
): number | null {
  if (invitation.maxUses === undefined || invitation.usedCount === undefined) return null;
  return Math.max(invitation.maxUses - invitation.usedCount, 0);
}
