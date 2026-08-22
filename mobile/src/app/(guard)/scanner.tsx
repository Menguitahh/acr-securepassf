import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/common/components/button';
import { LogoutButton } from '@/common/components/logout-button';
import { Spinner } from '@/common/components/spinner';
import { QueueStatus } from '@/modules/offline/components/queue-status';
import { useAccessCacheSync, useOutboxSync } from '@/modules/offline/hooks';
import { EnrollmentScreen } from '@/modules/scanner/components/enrollment-screen';
import { QrCamera } from '@/modules/scanner/components/qr-camera';
import { ScanResultScreen } from '@/modules/scanner/components/scan-result-screen';
import { useQrScanner } from '@/modules/scanner/hooks';

export default function ScannerScreen() {
  const router = useRouter();
  const {
    result,
    isPending,
    enrollment,
    enrollmentError,
    isEnrolling,
    onScan,
    submitEnrollment,
    cancelEnrollment,
    dismiss,
  } = useQrScanner();
  useOutboxSync();
  useAccessCacheSync();

  if (enrollment !== null) {
    return (
      <View className="flex-1 bg-bg-base">
        <EnrollmentScreen
          isSubmitting={isEnrolling}
          error={enrollmentError}
          onSubmit={submitEnrollment}
          onCancel={cancelEnrollment}
        />
        <View className="absolute right-4 top-12 flex-row gap-2">
          <Button label="Presentes" onPress={() => router.push('/(guard)/stays')} />
          <LogoutButton />
        </View>
      </View>
    );
  }

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
