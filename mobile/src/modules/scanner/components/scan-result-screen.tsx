import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';

import type { ScanResult } from '@/modules/scanner/types';

const AUTO_DISMISS_MS = 2500;

type ScanResultScreenProps = {
  result: ScanResult;
  onDismiss: () => void;
};

export function ScanResultScreen({ result, onDismiss }: ScanResultScreenProps) {
  const allowed = result.status === 'allowed';

  useEffect(() => {
    void Haptics.notificationAsync(
      allowed
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [allowed, onDismiss]);

  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Cerrar resultado"
      className={`flex-1 items-center justify-center gap-3 p-8 ${allowed ? 'bg-allow' : 'bg-deny'}`}
    >
      <Text className="text-center text-[32px] font-semibold leading-tight text-bg-base">
        {allowed ? (result.guestName ?? 'Ingreso autorizado') : 'Acceso denegado'}
      </Text>
      {allowed && result.lotCode ? (
        <Text className="text-xl text-bg-base">{result.lotCode}</Text>
      ) : null}
      {!allowed ? (
        <Text className="text-center text-xl leading-snug text-bg-base">
          {result.message}
        </Text>
      ) : null}
    </Pressable>
  );
}
