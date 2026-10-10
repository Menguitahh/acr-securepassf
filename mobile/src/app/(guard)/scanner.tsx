import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/common/components/button';
import { Spinner } from '@/common/components/spinner';
import { QueueStatus } from '@/modules/offline/components/queue-status';
import { useAccessCacheSync, useOutboxSync } from '@/modules/offline/hooks';
import { EnrollmentScreen } from '@/modules/scanner/components/enrollment-screen';
import { ActionGrid, type GuardAction } from '@/modules/scanner/components/action-grid';
import { DirectionToggle } from '@/modules/scanner/components/direction-toggle';
import { GuardHeader } from '@/modules/scanner/components/guard-header';
import { LotSelectionScreen } from '@/modules/scanner/components/lot-selection-screen';
import { QrCamera } from '@/modules/scanner/components/qr-camera';
import { ScanResultScreen } from '@/modules/scanner/components/scan-result-screen';
import { useQrScanner, useWorkerDocumentEntry } from '@/modules/scanner/hooks';
import { PANEL_PADDING } from '@/modules/scanner/data';
import type { Direction } from '@/modules/scanner/types';
import { useCurrentShift } from '@/modules/shifts/hooks';
import { useOpenStays, useSyncStayWarnings } from '@/modules/stays/hooks';
import { isOpenShift } from '@/modules/shifts/lib';

export default function ScannerScreen() {
  const router = useRouter();
  // US-20 / US-37: el mismo QR registra ingreso o egreso segun lo elegido.
  const [direction, setDirection] = useState<Direction>('IN');
  const insets = useSafeAreaInsets();
  const {
    result,
    isPending,
    enrollment,
    enrollmentError,
    isEnrolling,
    onScan,
    submitEnrollment,
    cancelEnrollment,
    lotSelection,
    chooseLot,
    cancelLotSelection,
    dismiss,
  } = useQrScanner(direction);
  const dniEntry = useWorkerDocumentEntry();
  const shift = useCurrentShift();
  useOutboxSync();
  useAccessCacheSync();
  // Avisos de permanencia (WBS-69): el guardia pasa el turno en el scanner,
  // no en Presentes. Sin esto solo se programaban al abrir Presentes.
  const openStays = useOpenStays();
  useSyncStayWarnings(openStays.data);

  // #232: el turno va en el encabezado; estas son las acciones frecuentes.
  const actions: GuardAction[] = [
    { label: 'Manual', icon: 'create-outline', onPress: () => router.push('/(guard)/manual') },
    { label: 'Trabajador sin QR', icon: 'id-card-outline', onPress: dniEntry.open },
    { label: 'Presentes', icon: 'people-outline', onPress: () => router.push('/(guard)/stays') },
    { label: 'Registro', icon: 'list-outline', onPress: () => router.push('/(guard)/log') },
  ];

  // #204: sin red y sin turno guardado no se sabe si hay turno. Es un
  // error, no "sin turno": se reintenta.
  if (shift.isError && shift.data === undefined) {
    return (
      <View className="flex-1 bg-bg-base">
        <GuardHeader />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-2xl font-semibold text-text-primary">
            No se pudo confirmar el turno
          </Text>
          <Text className="text-center text-body text-text-muted">
            Revisá la conexión y reintentá.
          </Text>
          <Button label="Reintentar" variant="primary" onPress={() => void shift.refetch()} />
        </View>
      </View>
    );
  }

  // Sin turno abierto, escanear deja el ingreso sin shift_id: se pierde
  // la trazabilidad de quien estaba en garita. Se bloquea todo el flujo
  // (camara + enrolamiento) hasta que abra un turno.
  if (!shift.isLoading && !isOpenShift(shift.data)) {
    return (
      <View className="flex-1 bg-bg-base">
        <GuardHeader />
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
      </View>
    );
  }

  if (dniEntry.entry !== null) {
    return (
      <View className="flex-1 bg-bg-base">
        <GuardHeader />
        <EnrollmentScreen
          purpose="worker_entry"
          invitationName={null}
          subjectKind="worker"
          lots={dniEntry.entry.lots}
          isSubmitting={dniEntry.isSubmitting}
          error={dniEntry.entry.error}
          onSubmit={(documentNumber, lotId) => void dniEntry.submit(documentNumber, lotId)}
          onCancel={dniEntry.cancel}
        />
      </View>
    );
  }

  if (dniEntry.result !== null) {
    return <ScanResultScreen result={dniEntry.result} onDismiss={dniEntry.dismiss} />;
  }

  if (enrollment !== null) {
    return (
      <View className="flex-1 bg-bg-base">
        <GuardHeader />
        <EnrollmentScreen
          invitationName={enrollment.invitationName}
          subjectKind={enrollment.subject.kind}
          lots={enrollment.lots}
          isSubmitting={isEnrolling}
          error={enrollmentError}
          onSubmit={submitEnrollment}
          onCancel={cancelEnrollment}
        />
      </View>
    );
  }

  if (lotSelection !== null) {
    return (
      <View className="flex-1 bg-bg-base">
        <GuardHeader />
        <LotSelectionScreen
          selection={lotSelection}
          isSubmitting={isPending}
          onChoose={(lot) => void chooseLot(lot)}
          onCancel={cancelLotSelection}
        />
      </View>
    );
  }

  // El resultado ocupa la pantalla entera (spec 9.3) y se cierra solo en
  // 2.5 s: no lleva toolbar encima.
  if (result !== null) return <ScanResultScreen result={result} onDismiss={dismiss} direction={direction} />;

  // Camara arriba y acciones abajo, al alcance del pulgar con una mano.
  return (
    <View className="flex-1 bg-bg-base">
      <GuardHeader />
      <View className="flex-1 overflow-hidden">
        {isPending ? (
          <View className="flex-1 items-center justify-center">
            <Spinner />
          </View>
        ) : (
          <QrCamera onScan={onScan} />
        )}
        <QueueStatus />
      </View>
      <View
        className="gap-3 border-t border-border bg-bg-base pt-3"
        style={{ paddingHorizontal: PANEL_PADDING, paddingBottom: insets.bottom + 12 }}
      >
        <DirectionToggle value={direction} onChange={setDirection} />
        <ActionGrid actions={actions} horizontalPadding={PANEL_PADDING} />
      </View>
    </View>
  );
}
