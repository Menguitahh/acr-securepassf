import { Pressable, Text } from 'react-native';

import type { ScanResult } from '@/modules/scanner/types';

// ponytail: overlay minimo a un tap; WBS-33 la reemplaza por la pantalla
// firma de spec 9.3 (haptica, auto-dismiss 2500 ms, reduce motion).
type ScanResultOverlayProps = {
  result: ScanResult;
  onDismiss: () => void;
};

export function ScanResultOverlay({ result, onDismiss }: ScanResultOverlayProps) {
  const allowed = result.status === 'allowed';

  return (
    <Pressable
      onPress={onDismiss}
      className={`flex-1 items-center justify-center gap-2 p-6 ${allowed ? 'bg-allow' : 'bg-deny'}`}
    >
      <Text className="text-2xl font-semibold text-bg-base">
        {allowed ? (result.guestName ?? 'Ingreso autorizado') : 'Acceso denegado'}
      </Text>
      {allowed && result.lotCode ? (
        <Text className="text-base text-bg-base">{result.lotCode}</Text>
      ) : null}
      {!allowed ? (
        <Text className="text-center text-base text-bg-base">{result.message}</Text>
      ) : null}
      <Text className="text-sm text-bg-base">Tocá para continuar</Text>
    </Pressable>
  );
}
