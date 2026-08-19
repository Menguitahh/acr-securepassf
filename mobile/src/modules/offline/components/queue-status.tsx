import { Text, View } from 'react-native';

import { QUEUE_ALERT_THRESHOLD } from '@/modules/offline/data';
import { useOfflineStore } from '@/modules/offline/offline-store';

export function QueueStatus() {
  const pendingCount = useOfflineStore((state) => state.pendingCount);

  if (pendingCount === 0) return null;

  return (
    <View className="absolute left-4 top-12 items-start gap-2 pr-4">
      <View className="rounded-full border border-border bg-bg-surface px-3 py-1">
        <Text className="text-sm text-text-primary">En cola: {pendingCount}</Text>
      </View>
      {pendingCount > QUEUE_ALERT_THRESHOLD ? (
        <View className="rounded-lg border border-border bg-bg-surface p-3">
          <Text className="text-sm leading-snug text-text-primary">
            Hay más de {QUEUE_ALERT_THRESHOLD} accesos sin sincronizar. Conectá el
            telefono a la red para sincronizar la cola.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
