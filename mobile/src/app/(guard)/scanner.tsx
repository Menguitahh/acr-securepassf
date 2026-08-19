import { View } from 'react-native';

import { LogoutButton } from '@/common/components/logout-button';
import { Spinner } from '@/common/components/spinner';
import { QueueStatus } from '@/modules/offline/components/queue-status';
import { useOutboxSync } from '@/modules/offline/hooks';
import { QrCamera } from '@/modules/scanner/components/qr-camera';
import { ScanResultScreen } from '@/modules/scanner/components/scan-result-screen';
import { useQrScanner } from '@/modules/scanner/hooks';

export default function ScannerScreen() {
  const { result, isPending, onScan, dismiss } = useQrScanner();
  useOutboxSync();

  return (
    <View className="flex-1 bg-bg-base">
      {result === null && !isPending ? <QrCamera onScan={onScan} /> : null}
      {isPending ? (
        <View className="absolute inset-0 items-center justify-center bg-bg-base/80">
          <Spinner />
        </View>
      ) : null}
      {result !== null ? <ScanResultScreen result={result} onDismiss={dismiss} /> : null}
      <QueueStatus />
      <View className="absolute right-4 top-12">
        <LogoutButton />
      </View>
    </View>
  );
}
