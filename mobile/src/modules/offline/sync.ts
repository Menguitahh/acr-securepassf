import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { components } from '@securepass/contracts';

import { api, authRequest } from '@/common/api/client';
import { SYNC_BATCH_SIZE } from '@/modules/offline/data';
import { forgetEnrollment } from '@/modules/offline/enrollments-cache';
import {
  backoffDelayFor,
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
// - Sin id no se puede accionar: se retry para no descartar por accidente.
function classifyResults(
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

    if (result.result === 'DENIED' && result.reason === 'DOCUMENT_MISMATCH' && event.documentNumber !== null) {
      // Enrolamiento offline rechazado por DNI que no coincide. Extraer
      // invitationId del token para saber que fila borrar en cache. Es
      // seguro: parseToken es puro, tolera tokens invalidos con null.
      const invitationId = extractInvitationId(event.token);
      if (invitationId) forgetEnrollment(invitationId);
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

// Import lazy para no crear un ciclo lib.ts <-> scanner/lib.ts. En la
// mayoria de los casos el server confirma sin MISMATCH, esta funcion no
// se ejecuta.
function extractInvitationId(token: string): string | null {
  // ponytail: parse mınimo del payload SP1.<base64url>.<sig>. Alcanza
  // con leer la propiedad `i` del payload JSON. Si el parse falla, null
  // y no borramos nada — el sync no debe romper por un token corrupto.
  try {
    const body = token.startsWith('SP1.') ? token.slice(4) : token;
    const [payloadPart] = body.split('.');
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return typeof json?.i === 'string' ? json.i : null;
  } catch {
    return null;
  }
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
        const { data, error } = await authRequest(() =>
          api.POST('/api/v1/access/sync', {
            body: { deviceId, events: syncEvents },
          }),
        );
        if (error) throw new Error('el server rechazo el sync');
        return classifyResults(events, data?.results ?? []);
      },
      remove: removeEvents,
      markFailure: markSyncFailure,
    },
    SYNC_BATCH_SIZE,
  );
}
