import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Card } from '@/common/components/card';
import { ErrorState } from '@/common/components/error-state';
import { Input } from '@/common/components/input';
import { Spinner } from '@/common/components/spinner';
import { useCloseShift, useCurrentShift, useOpenShift } from '@/modules/shifts/hooks';
import { elapsedMinutes, formatElapsed, isOpenShift, pickCloseDialog } from '@/modules/shifts/lib';
import type { Shift } from '@/modules/shifts/types';
import { useOpenStays } from '@/modules/stays/hooks';

const ELAPSED_TICK_MS = 30_000;

export function ShiftsView() {
  const { data, isLoading, isError, error, refetch } = useCurrentShift();
  const open = useOpenShift();
  const close = useCloseShift();
  const stays = useOpenStays();
  const router = useRouter();
  const [notes, setNotes] = useState('');

  if (isError) {
    return (
      <View className="flex-1 bg-bg-base">
        <ErrorState
          message={`${error instanceof Error ? error.message : 'No se pudo cargar el turno.'} Reintentá en unos segundos.`}
        />
        <View className="px-6 pb-6">
          <Button label="Reintentar" variant="primary" onPress={() => void refetch()} />
        </View>
      </View>
    );
  }
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-base">
        <Spinner />
      </View>
    );
  }

  if (isOpenShift(data)) {
    const doClose = () =>
      close.mutate(notes.trim(), {
        onSuccess: () => setNotes(''),
        onError: (err) =>
          Alert.alert(
            'No se pudo cerrar',
            err instanceof Error ? err.message : 'Reintentá en unos segundos.',
          ),
      });

    const choice = pickCloseDialog({
      isLoading: stays.isLoading,
      isError: stays.isError,
      count: stays.data?.length,
    });

    return (
      <OpenShiftView
        shift={data}
        isClosing={close.isPending}
        closeLabel={choice.kind === 'disabled' ? 'Verificando estadias…' : 'Cerrar turno'}
        closeDisabled={choice.kind === 'disabled'}
        notes={notes}
        onNotes={setNotes}
        onClose={() => {
          if (choice.kind === 'confirm-with-open') {
            const noun = choice.count === 1 ? 'visitante' : 'visitantes';
            const verb = choice.count === 1 ? 'no marcó egreso' : 'no marcaron egreso';
            Alert.alert(
              `Hay ${choice.count} ${noun} adentro`,
              `Quedan ${choice.count} ${noun} que ${verb}. Si cerrás el turno, siguen registrados como presentes y el próximo guardia no va a saber que estaban pendientes.`,
              [
                {
                  text: 'Marcar egresos',
                  onPress: () => router.push('/(guard)/stays'),
                },
                { text: 'Cerrar igual', style: 'destructive', onPress: doClose },
                { text: 'Cancelar', style: 'cancel' },
              ],
              { cancelable: true },
            );
            return;
          }
          if (choice.kind === 'warn-unknown') {
            Alert.alert(
              'No se pudo verificar estadias',
              'No pudimos confirmar cuántos visitantes quedan adentro (sin red o el servidor no respondió). Podés cerrar igual, pero revisá después la lista de presentes por si quedaron sin egreso.',
              [
                { text: 'Cerrar igual', style: 'destructive', onPress: doClose },
                { text: 'Cancelar', style: 'cancel' },
              ],
              { cancelable: true },
            );
            return;
          }
          // 'confirm-empty': N === 0, confirmacion generica.
          Alert.alert(
            'Cerrar turno',
            '¿Cerrar el turno actual?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Cerrar', style: 'destructive', onPress: doClose },
            ],
            { cancelable: true },
          );
        }}
      />
    );
  }

  return (
    <ClosedShiftView
      isOpening={open.isPending}
      notes={notes}
      onNotes={setNotes}
      onOpen={() =>
        open.mutate(notes.trim(), {
          onSuccess: () => setNotes(''),
          onError: (err) =>
            Alert.alert(
              'No se pudo abrir',
              err instanceof Error ? err.message : 'Reintentá en unos segundos.',
            ),
        })
      }
    />
  );
}

type OpenShiftViewProps = {
  shift: Shift;
  isClosing: boolean;
  closeLabel: string;
  closeDisabled: boolean;
  notes: string;
  onNotes: (value: string) => void;
  onClose: () => void;
};

function OpenShiftView({
  shift,
  isClosing,
  closeLabel,
  closeDisabled,
  notes,
  onNotes,
  onClose,
}: OpenShiftViewProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS);
    return () => clearInterval(id);
  }, []);
  const minutes = elapsedMinutes(shift.startedAt, now);

  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-6">
      <Card>
        <Text className="text-footnote text-text-muted">Turno abierto</Text>
        <Text className="mt-2 text-2xl font-semibold text-text-primary">
          {minutes !== null ? formatElapsed(minutes) : 'Sin inicio registrado'}
        </Text>
        {shift.handoverNotes ? (
          <Text className="mt-3 text-body text-text-muted">
            Nota de entrada: {shift.handoverNotes}
          </Text>
        ) : null}
      </Card>

      <View className="gap-2">
        <Input
          label="Nota de entrega (opcional)"
          value={notes}
          onChangeText={onNotes}
          placeholder="Novedades del turno, incidentes, entrega..."
          editable={!isClosing}
          multiline
        />
        {isClosing ? <Spinner /> : null}
        <Button
          label={closeLabel}
          variant="primary"
          disabled={isClosing || closeDisabled}
          onPress={onClose}
        />
      </View>
    </ScrollView>
  );
}

type ClosedShiftViewProps = {
  isOpening: boolean;
  notes: string;
  onNotes: (value: string) => void;
  onOpen: () => void;
};

function ClosedShiftView({ isOpening, notes, onNotes, onOpen }: ClosedShiftViewProps) {
  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-6">
      <Card>
        <Text className="text-footnote text-text-muted">Sin turno abierto</Text>
        <Text className="mt-2 text-body text-text-primary">
          Abrí un turno para que los ingresos y egresos se registren a tu nombre.
        </Text>
      </Card>

      <View className="gap-2">
        <Input
          label="Nota de entrada (opcional)"
          value={notes}
          onChangeText={onNotes}
          placeholder="Novedades recibidas del turno anterior..."
          editable={!isOpening}
          multiline
        />
        {isOpening ? <Spinner /> : null}
        <Button label="Abrir turno" variant="primary" disabled={isOpening} onPress={onOpen} />
      </View>
    </ScrollView>
  );
}
