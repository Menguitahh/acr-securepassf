import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { LogoutButton } from '@/common/components/logout-button';
import { Spinner } from '@/common/components/spinner';
import { QueueStatus } from '@/modules/offline/components/queue-status';
import { useAccessCacheSync, useOutboxSync } from '@/modules/offline/hooks';
import { EnrollmentScreen } from '@/modules/scanner/components/enrollment-screen';
import { QrCamera } from '@/modules/scanner/components/qr-camera';
import { ScanResultScreen } from '@/modules/scanner/components/scan-result-screen';
import { useQrScanner } from '@/modules/scanner/hooks';
import { useCurrentShift } from '@/modules/shifts/hooks';
import { isOpenShift } from '@/modules/shifts/lib';

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
  const shift = useCurrentShift();
  useOutboxSync();
  useAccessCacheSync();

  // Sin turno abierto, escanear deja el ingreso sin shift_id: se pierde
  // la trazabilidad de quien estaba en garita. Se bloquea todo el flujo
  // (camara + enrolamiento) hasta que abra un turno.
  if (!shift.isLoading && !isOpenShift(shift.data)) {
    return (
      <View className="flex-1 bg-bg-base">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-2xl font-semibold text-text-primary">
            No hay turno abierto
          </Text>
          <Text className="text-center text-body text-text-muted">
            Abrí tu turno antes de escanear. Los ingresos tienen que quedar
            registrados a nombre de un guardia.
          </Text>
          <Button
            label="Abrir turno"
            variant="primary"
            onPress={() => router.push('/(guard)/shifts')}
          />
        </View>
        <View className="absolute right-4 top-12 flex-row gap-2">
          <LogoutButton />
        </View>
      </View>
    );
  }

  if (enrollment !== null) {
    return (
      <View className="flex-1 bg-bg-base">
        <EnrollmentScreen
          invitationName={enrollment.invitationName}
          isSubmitting={isEnrolling}
          error={enrollmentError}
          onSubmit={submitEnrollment}
          onCancel={cancelEnrollment}
        />
        <View className="absolute right-4 top-12 flex-row gap-2">
          <Button label="Manual" onPress={() => router.push('/(guard)/manual')} />
          <Button label="Turno" onPress={() => router.push('/(guard)/shifts')} />
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
      <View className="absolute right-4 top-12 flex-row gap-2">
        <Button label="Turno" onPress={() => router.push('/(guard)/shifts')} />
        <Button label="Presentes" onPress={() => router.push('/(guard)/stays')} />
        <LogoutButton />
      </View>
    </View>
  );
}
