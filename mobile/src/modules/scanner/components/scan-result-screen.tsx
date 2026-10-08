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
  // Spec 9.3: Success en permitido, Error en denegado.
  const feedback =
    result.status === 'allowed'
      ? Haptics.NotificationFeedbackType.Success
      : result.status === 'denied'
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Warning;

  useEffect(() => {
    void Haptics.notificationAsync(feedback);
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [feedback, onDismiss]);

  const background =
    result.status === 'allowed'
      ? 'bg-allow'
      : result.status === 'denied'
        ? 'bg-deny'
        : 'bg-warn';

  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Cerrar resultado"
      className={`flex-1 items-center justify-center gap-3 p-8 ${background}`}
    >
      <Text className="text-center text-[32px] font-semibold leading-tight text-bg-base">
        {result.status === 'allowed'
          ? (result.guestName ?? 'Ingreso autorizado')
          : result.status === 'needs_enrollment'
            ? 'Falta enrolar DNI'
            : 'Acceso denegado'}
      </Text>
      {result.status === 'allowed' && result.lotCode ? (
        <Text className="text-xl text-bg-base">{result.lotCode}</Text>
      ) : null}
      {result.status === 'allowed' && result.offlineEnrolled ? (
        <Text className="text-center text-xl leading-snug text-bg-base">
          Enrolamiento sin conexión. Se registra al volver la red.
        </Text>
      ) : null}
      {result.status === 'denied' ? (
        <Text className="text-center text-xl leading-snug text-bg-base">
          {result.message}
        </Text>
      ) : null}
      {result.status === 'needs_enrollment' ? (
        <Text className="text-center text-xl leading-snug text-bg-base">
          Escaneá el DNI del invitado para completar el ingreso.
        </Text>
      ) : null}
    </Pressable>
  );
}
