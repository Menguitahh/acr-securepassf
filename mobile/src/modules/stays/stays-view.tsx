import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { EmptyState } from '@/common/components/empty-state';
import { ErrorState } from '@/common/components/error-state';
import { Spinner } from '@/common/components/spinner';
import { useCloseStay, useOpenStays } from '@/modules/stays/hooks';
import { formatEnteredAt, isNearExpiry, sortByEnteredAtDesc } from '@/modules/stays/lib';
import type { Stay } from '@/modules/stays/types';

export function StaysView() {
  const { data, isLoading, isError, error, refetch } = useOpenStays();
  const close = useCloseStay();

  const askClose = (stay: Stay) => {
    const name = stay.subjectName ?? 'este ingreso';
    Alert.alert(
      'Cerrar estadia',
      `¿Registrar el egreso de ${name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: () => {
            if (!stay.id) return;
            close.mutate(stay.id, {
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
    );
  };

  if (isError) {
    return (
      <View className="flex-1 bg-bg-base">
        <ErrorState
          message={`${error instanceof Error ? error.message : 'No se pudo cargar la lista.'} Reintentá en unos segundos.`}
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
  if (!data?.length) {
    return (
      <View className="flex-1 bg-bg-base">
        <EmptyState
          title="No hay presentes ahora."
          description="Los ingresos autorizados van a aparecer aca hasta que se registre el egreso."
        />
      </View>
    );
  }

  const sorted = sortByEnteredAtDesc(data);

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.id ?? ''}
      contentContainerClassName="gap-3 px-6 pb-6"
      renderItem={({ item }) => {
        const near = isNearExpiry(item);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Cerrar estadia de ${item.subjectName ?? 'presente'}`}
            onPress={() => askClose(item)}
            className={`min-h-12 rounded-lg border p-4 active:opacity-70 ${
              near
                ? 'border-warn bg-warn/10'
                : 'border-border bg-bg-surface'
            }`}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-body font-semibold text-text-primary">
                  {item.subjectName ?? 'Sin nombre'}
                </Text>
                <Text className="text-footnote text-text-muted">
                  {item.lotCode ? `Lote ${item.lotCode}` : 'Sin lote'}
                  {item.enteredAt ? ` · Ingreso ${formatEnteredAt(item.enteredAt)}` : ''}
                </Text>
              </View>
              {typeof item.minutesRemaining === 'number' ? (
                <Text
                  className={`text-footnote font-semibold ${near ? 'text-warn' : 'text-text-muted'}`}
                >
                  {item.minutesRemaining <= 0
                    ? 'Vencido'
                    : `${item.minutesRemaining} min`}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}
