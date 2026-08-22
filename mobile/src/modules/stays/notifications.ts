import * as Notifications from 'expo-notifications';

import { computeWarningSchedule } from '@/modules/stays/lib';
import type { Stay } from '@/modules/stays/types';
import {
  forgetWarning,
  hasBeenWarned,
  recordWarning,
  warnedStayIds,
} from '@/modules/stays/warnings-store';

let permissionResolved = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionResolved) return permissionGranted;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) {
    permissionGranted = true;
  } else {
    const request = await Notifications.requestPermissionsAsync();
    permissionGranted = request.granted;
  }
  permissionResolved = true;
  return permissionGranted;
}

function buildContent(stay: Stay): Notifications.NotificationContentInput {
  const who = stay.subjectName ?? 'un invitado';
  const lot = stay.lotCode ? ` (Lote ${stay.lotCode})` : '';
  return {
    title: 'Permanencia por vencer',
    body: `${who}${lot} esta por vencer. Verificá el egreso.`,
    sound: 'default',
  };
}

// Programa (o dispara ya) el aviso local para un stay. Idempotente:
// llamar dos veces con el mismo stay no crea dos notificaciones. Se
// asume ejecucion desde useSyncStayWarnings, que ya filtra los skip.
async function scheduleForStay(stay: Stay, fireAt: number | null): Promise<void> {
  if (!stay.id) return;
  const granted = await ensurePermission();
  if (!granted) {
    // Sin permiso no hay notificacion posible, pero se marca como
    // avisado para que la fila resaltada en la UI cumpla el otro
    // canal de aviso al guardia.
    recordWarning(stay.id, null);
    return;
  }
  const identifier = await Notifications.scheduleNotificationAsync({
    content: buildContent(stay),
    trigger:
      fireAt === null
        ? null
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
  });
  recordWarning(stay.id, identifier);
}

// Reconciliacion: para cada stay abierto, programa el aviso si
// corresponde. Idempotente. Para stays que ya cerraron o se borraron
// del servidor, cancela la notificacion pendiente y limpia el flag.
export async function syncStayWarnings(stays: readonly Stay[], now: number): Promise<void> {
  const alreadyWarned = warnedStayIds();
  const seen = new Set<string>();

  for (const stay of stays) {
    if (!stay.id) continue;
    seen.add(stay.id);
    if (alreadyWarned.has(stay.id)) continue;
    const schedule = computeWarningSchedule(stay, now, false);
    if (schedule.action === 'schedule') {
      await scheduleForStay(stay, schedule.fireAt);
    } else if (schedule.action === 'fireNow') {
      await scheduleForStay(stay, null);
    }
  }

  // Stays que ya no estan abiertos (cerrados o expirados y purgados):
  // cancelar cualquier notificacion pendiente para no molestar.
  for (const stayId of alreadyWarned) {
    if (seen.has(stayId)) continue;
    const notifId = forgetWarning(stayId);
    if (notifId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notifId);
      } catch {
        // La notificacion pudo haber disparado ya; no importa.
      }
    }
  }
}

export function isLocallyWarned(stayId: string): boolean {
  return hasBeenWarned(stayId);
}
