import type * as Notifications from 'expo-notifications';

import { api, authRequest } from '@/common/api/client';
import { getNotifications } from '@/common/notifications/safe';
import { computeWarningSchedule } from '@/modules/stays/lib';
import type { Stay } from '@/modules/stays/types';
import {
  forgetWarning,
  hasBeenWarned,
  markSyncedToServer,
  recordWarning,
  warnedStayStates,
} from '@/modules/stays/warnings-store';

let permissionResolved = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionResolved) return permissionGranted;
  const N = await getNotifications();
  if (!N) {
    // Expo Go: no hay canal de notif. Se marca como resuelto para no reintentar.
    permissionResolved = true;
    permissionGranted = false;
    return false;
  }
  const settings = await N.getPermissionsAsync();
  if (settings.granted) {
    permissionGranted = true;
  } else {
    const request = await N.requestPermissionsAsync();
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
  // ensurePermission=true garantiza que N no es null aca, pero el wrapper
  // devuelve promise: hay que re-consultarlo. Cache hit en el segundo call.
  const N = await getNotifications();
  if (!N) return;
  const identifier = await N.scheduleNotificationAsync({
    content: buildContent(stay),
    trigger:
      fireAt === null
        ? null
        : { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
  });
  recordWarning(stay.id, identifier);
}

// Persiste server-side que este device se hizo cargo del aviso (#31).
// Idempotente: el server hace first-writer-wins. Falla silenciosa; el
// proximo ciclo de sync detecta la divergencia y reintenta.
async function postMarkWarned(stayId: string): Promise<boolean> {
  try {
    const { error } = await authRequest(() =>
      api.POST('/api/v1/stays/{id}/mark-warned', {
        params: { path: { id: stayId } },
      }),
    );
    if (error) return false;
    markSyncedToServer(stayId);
    return true;
  } catch {
    return false;
  }
}

// Reconciliacion: para cada stay abierto, programa el aviso si
// corresponde. Idempotente. Para stays que ya cerraron o se borraron
// del servidor, cancela la notificacion pendiente y limpia el flag.
export async function syncStayWarnings(stays: readonly Stay[], now: number): Promise<void> {
  const N = await getNotifications();
  // Expo Go: no-op completo. El aviso local depende del modulo nativo.
  if (!N) return;

  const localStates = warnedStayStates();
  const seen = new Set<string>();

  for (const stay of stays) {
    if (!stay.id) continue;
    seen.add(stay.id);
    const local = localStates.get(stay.id);
    const locallyWarned = local !== undefined;
    const locallySynced = local?.syncedToServer ?? false;
    const schedule = computeWarningSchedule(stay, now, locallyWarned, locallySynced);

    if (schedule.action === 'schedule') {
      await scheduleForStay(stay, schedule.fireAt);
      await postMarkWarned(stay.id);
    } else if (schedule.action === 'fireNow') {
      await scheduleForStay(stay, null);
      await postMarkWarned(stay.id);
    } else if (schedule.action === 'markWarned') {
      if (schedule.divergent) {
        console.warn(
          `[stays] divergencia mark-warned stay=${stay.id}: locallySynced=true pero server.warned=false. Reintentando POST — si O el server perdio el mark O el flag local miente, esto lo corrige.`,
        );
      }
      await postMarkWarned(stay.id);
    } else if (schedule.action === 'cancel') {
      // Cross-device: otro guardia disparo el aviso y marco warned
      // server-side primero. Cancelar la notif local pendiente para
      // no duplicar. Ver computeWarningSchedule para la tabla completa.
      const notifId = forgetWarning(stay.id);
      if (notifId) {
        try {
          await N.cancelScheduledNotificationAsync(notifId);
        } catch {
          // La notif pudo haber disparado ya entre el poll y este cancel; no importa.
        }
      }
    }
  }

  // Stays que ya no estan abiertos (cerrados o expirados y purgados):
  // cancelar cualquier notificacion pendiente para no molestar.
  for (const stayId of localStates.keys()) {
    if (seen.has(stayId)) continue;
    const notifId = forgetWarning(stayId);
    if (notifId) {
      try {
        await N.cancelScheduledNotificationAsync(notifId);
      } catch {
        // La notificacion pudo haber disparado ya; no importa.
      }
    }
  }
}

export function isLocallyWarned(stayId: string): boolean {
  return hasBeenWarned(stayId);
}
