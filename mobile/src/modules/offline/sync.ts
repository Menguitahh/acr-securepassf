import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { components } from '@securepass/contracts';

import { api, authRequest } from '@/common/api/client';
import { SYNC_BATCH_SIZE } from '@/modules/offline/data';
import { runSyncCycle, toSyncEvent } from '@/modules/offline/lib';
import { backoffDelayFor } from '@/modules/offline/lib';
import {
  markSyncFailure,
  maxSyncAttempts,
  peekPendingEvents,
  removeEvents,
} from '@/modules/offline/outbox';

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

export async function syncOutbox(): Promise<'empty' | 'synced' | 'error'> {
  const deviceId = await getDeviceId();
  return runSyncCycle(
    {
      peek: (limit) => peekPendingEvents(limit).filter((event) => event.gateId !== null),
      send: async (events) => {
        const syncEvents: components['schemas']['Event'][] = [];
        for (const event of events) {
          const mapped = toSyncEvent(event);
          if (mapped) syncEvents.push(mapped);
        }
        const { error } = await authRequest(() =>
          api.POST('/api/v1/access/sync', {
            body: { deviceId, events: syncEvents },
          }),
        );
        if (error) throw new Error('el server rechazo el sync');
      },
      remove: removeEvents,
      markFailure: markSyncFailure,
    },
    SYNC_BATCH_SIZE,
  );
}
