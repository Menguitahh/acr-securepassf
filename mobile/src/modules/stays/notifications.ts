import type * as Notifications from 'expo-notifications';

import { api, authRequest } from '@/common/api/client';
import { getNotifications } from '@/common/notifications/safe';
import { computeWarningSchedule, isWarningDue } from '@/modules/stays/lib';
import type { LocalWarning, Stay } from '@/modules/stays/types';
import {
  forgetWarning,
  markSyncedToServer,
  recordWarning,
  warningStates,
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
    recordWarning(stay.id, null, fireAt ?? Date.now());
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
  recordWarning(stay.id, identifier, fireAt ?? Date.now());
}

// Avisa al server que el aviso de esta estadia ya disparo (#31): la home del
// residente muestra la card de "por vencer" con eso. Idempotente en el server
// (first-writer-wins). Si falla, el proximo ciclo lo reintenta (markWarned).
async function postMarkWarned(stayId: string): Promise<void> {
  try {
    const { error } = await authRequest(() =>
      api.POST('/api/v1/stays/{id}/mark-warned', { params: { path: { id: stayId } } }),
    );
    if (!error) markSyncedToServer(stayId);
  } catch {
    // Sin red: queda pendiente para el proximo ciclo.
  }
}

// Reconciliacion: para cada stay abierto, programa el aviso, avisa al
// server cuando vence, y cancela el pendiente si otro dispositivo aviso
// primero. Para stays que ya cerraron, cancela la notificacion y limpia.
// Single-flight: lo montan el scanner y Presentes a la vez, y dos corridas
// en paralelo programarian el mismo aviso dos veces.
let syncing = false;

export async function syncStayWarnings(stays: readonly Stay[], now: number): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    await reconcile(stays, now);
  } finally {
    syncing = false;
  }
}

async function reconcile(stays: readonly Stay[], now: number): Promise<void> {
  const N = await getNotifications();
  // Expo Go: no-op completo. El aviso local depende del modulo nativo.
  if (!N) return;

  const local = warningStates();
  const seen = new Set<string>();

  for (const stay of stays) {
    if (!stay.id) continue;
    seen.add(stay.id);
    const schedule = computeWarningSchedule(stay, now, local.get(stay.id));
    if (schedule.action === 'schedule') {
      await scheduleForStay(stay, schedule.fireAt);
    } else if (schedule.action === 'fireNow') {
      await scheduleForStay(stay, null);
      await postMarkWarned(stay.id);
    } else if (schedule.action === 'markWarned') {
      await postMarkWarned(stay.id);
    } else if (schedule.action === 'cancel') {
      await cancelPending(N, stay.id);
    }
  }

  // Stays que ya no estan abiertos (cerrados o expirados y purgados):
  // cancelar cualquier notificacion pendiente para no molestar.
  for (const stayId of local.keys()) {
    if (!seen.has(stayId)) await cancelPending(N, stayId);
  }
}

async function cancelPending(
  N: NonNullable<Awaited<ReturnType<typeof getNotifications>>>,
  stayId: string,
): Promise<void> {
  const notifId = forgetWarning(stayId);
  if (!notifId) return;
  try {
    await N.cancelScheduledNotificationAsync(notifId);
  } catch {
    // La notificacion pudo haber disparado ya; no importa.
  }
}

// La fila se resalta solo si el aviso de este dispositivo ya vencio.
export function isLocallyWarned(stay: Stay, local: Map<string, LocalWarning>, now: number): boolean {
  return stay.id ? isWarningDue(stay, local.get(stay.id), now) : false;
}
