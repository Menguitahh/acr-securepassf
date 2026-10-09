import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { components } from '@securepass/contracts';

import { api } from '@/common/api/client';
import { SYNC_BATCH_SIZE } from '@/modules/offline/data';
import { forgetEnrollment } from '@/modules/offline/enrollments-cache';
import { forgetWorkerEnrollment } from '@/modules/offline/worker-cache';
import {
  backoffDelayFor,
  extractEnrollmentSubject,
  hasValidGate,
  runSyncCycle,
  toSyncEvent,
  type SendOutcome,
} from '@/modules/offline/lib';
import {
  markSyncFailure,
  maxSyncAttempts,
  peekPendingEvents,
  removeEvents,
} from '@/modules/offline/outbox';
import type { OutboxEvent } from '@/modules/offline/types';

const DEVICE_ID_KEY = 'securepass.device-id';

async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export function retryDelayMs(): number {
  return backoffDelayFor(maxSyncAttempts());
}

// Manejo de la respuesta per-evento del server (#27):
//
// - Cada EventResult trae result (ALLOWED/DENIED/ENROLLED) y opcionalmente
//   reason (DenialReason enum). El server tomo veredicto — no reintentamos.
// - DOCUMENT_MISMATCH sobre un evento de enrolamiento: el DNI capturado
//   offline no coincide con el que espera la invitacion. El cache local
//   quedo mentiroso (permitio el ingreso subsiguiente sin volver a pedir
//   DNI). Se limpia para que el proximo scan del mismo QR vuelva a pedir
//   DNI y el guardia pueda corregir.
// - REJECTED + INVALID_LOCAL_DECISION: el evento salio mal armado de este
//   cliente (decision o motivo invalidos). Reintentarlo da lo mismo: se
//   loguea con su clientEventId para rastrear el bug y sale de la cola.
// - Sin id no se puede accionar: se retry para no descartar por accidente.
export function classifyResults(
  batch: OutboxEvent[],
  results: components['schemas']['EventResult'][],
): SendOutcome {
  const eventsById = new Map(batch.map((event) => [event.clientEventId, event]));
  const remove: string[] = [];
  const retry: string[] = [];

  for (const result of results) {
    const id = result.clientEventId;
    if (!id) continue;
    const event = eventsById.get(id);
    if (!event) continue;

    if (result.result === 'REJECTED' && result.rejection === 'INVALID_LOCAL_DECISION') {
      console.error(`[outbox] evento ${id} rechazado por INVALID_LOCAL_DECISION: bug del cliente, se descarta`);
    }
    if (event.documentNumber !== null && result.result !== 'ENROLLED' && result.result !== 'ALLOWED') {
      // Enrolamiento offline que el server no confirmo (DNI que no coincide,
      // pase vencido o revocado, evento rechazado): la fila local se va, si
      // no ese telefono deja pasar sin red sin volver a pedir el DNI (#179).
      // El token dice que fila borrar: la invitacion o el trabajador.
      const subject = extractEnrollmentSubject(event.token);
      if (subject?.kind === 'worker') forgetWorkerEnrollment(subject.userId);
      else if (subject) forgetEnrollment(subject.invitationId);
    }
    remove.push(id);
  }

  // Eventos que el server no menciono: raro (deberia contestar per-evento
  // sobre todo el batch), pero por defensivo se marcan retry en vez de
  // asumir aceptados.
  const reportedIds = new Set(results.map((r) => r.clientEventId).filter((id): id is string => !!id));
  for (const event of batch) {
    if (!reportedIds.has(event.clientEventId)) retry.push(event.clientEventId);
  }

  return { remove, retry };
}

export async function syncOutbox(): Promise<'empty' | 'synced' | 'error'> {
  const deviceId = await getDeviceId();
  return runSyncCycle(
    {
      peek: (limit) => peekPendingEvents(limit).filter((event) => hasValidGate(event.gateId)),
      send: async (events) => {
        const syncEvents: components['schemas']['Event'][] = [];
        for (const event of events) {
          const mapped = toSyncEvent(event);
          if (mapped) syncEvents.push(mapped);
        }
        const { data, error } = await api.POST('/api/v1/access/sync', {
          body: { deviceId, events: syncEvents },
        });
        if (error) throw new Error('el server rechazo el sync');
        return classifyResults(events, data?.results ?? []);
      },
      remove: removeEvents,
      markFailure: markSyncFailure,
    },
    SYNC_BATCH_SIZE,
  );
}
