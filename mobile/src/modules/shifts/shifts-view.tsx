import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Card } from '@/common/components/card';
import { ErrorState } from '@/common/components/error-state';
import { Input } from '@/common/components/input';
import { Spinner } from '@/common/components/spinner';
import { useCloseShift, useCurrentShift, useOpenShift } from '@/modules/shifts/hooks';
import { elapsedMinutes, formatElapsed, isOpenShift } from '@/modules/shifts/lib';
import type { Shift } from '@/modules/shifts/types';

const ELAPSED_TICK_MS = 30_000;

export function ShiftsView() {
  const { data, isLoading, isError, error, refetch } = useCurrentShift();
  const open = useOpenShift();
  const close = useCloseShift();
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
    return (
      <OpenShiftView
        shift={data}
        isClosing={close.isPending}
        notes={notes}
        onNotes={setNotes}
        onClose={() =>
          Alert.alert(
            'Cerrar turno',
            '¿Cerrar el turno actual?',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Cerrar',
                style: 'destructive',
                onPress: () => {
                  close.mutate(notes.trim(), {
                    onSuccess: () => setNotes(''),
                    onError: (err) =>
                      Alert.alert(
                        'No se pudo cerrar',
                        err instanceof Error ? err.message : 'Reintentá en unos segundos.',
                      ),
                  });
                },
              },
            ],
            { cancelable: true },
          )
        }
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
  notes: string;
  onNotes: (value: string) => void;
  onClose: () => void;
};

function OpenShiftView({ shift, isClosing, notes, onNotes, onClose }: OpenShiftViewProps) {
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
        <Button label="Cerrar turno" variant="primary" disabled={isClosing} onPress={onClose} />
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
