import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { Button } from '@/common/components/button';
import { EmptyState } from '@/common/components/empty-state';
import { ErrorState } from '@/common/components/error-state';
import { Spinner } from '@/common/components/spinner';
import { AccessLogRow } from '@/modules/access-log/components/access-log-row';
import { HISTORY_FILTERS } from '@/modules/access-log/data';
import { useLotHistory } from '@/modules/access-log/hooks';
import type { HistoryFilter } from '@/modules/access-log/types';

// US-26: historial de accesos de los lotes del residente, ultimos 90 dias,
// paginado y con filtro por tipo. Los denegados nombran el pase, no a quien
// lo presento (#214).
export function HistoryView() {
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const { data, dataUpdatedAt, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLotHistory(filter);

  const filters = (
    <View className="flex-row gap-2 px-6 pb-3">
      {HISTORY_FILTERS.map((option) => (
        <View key={option.value} className="flex-1">
          <Button label={option.label} selected={filter === option.value} onPress={() => setFilter(option.value)} />
        </View>
      ))}
    </View>
  );

  if (isError && data === undefined) {
    return (
      <View className="flex-1">
        {filters}
        <ErrorState message="No se pudo cargar el historial. Revisá la conexión y reintentá." />
        <View className="px-6 pb-6">
          <Button label="Reintentar" variant="primary" onPress={() => void refetch()} />
        </View>
      </View>
    );
  }
  if (isLoading) {
    return (
      <View className="flex-1">
        {filters}
        <Spinner />
      </View>
    );
  }
  const items = data?.pages.flatMap((page) => page.items ?? []) ?? [];
  if (!items.length) {
    return (
      <View className="flex-1">
        {filters}
        <EmptyState
          title="No hay accesos en los últimos 90 días."
          description="Acá vas a ver quién entró y salió de tu lote, y los pases que se rechazaron en la garita."
        />
      </View>
    );
  }
  const now = new Date(dataUpdatedAt);
  return (
    <View className="flex-1">
      {filters}
      <FlatList
        data={items}
        keyExtractor={(item, index) => item.id ?? String(index)}
        contentContainerClassName="gap-3 px-6 pb-6"
        renderItem={({ item }) => <AccessLogRow item={item} now={now} />}
        ListFooterComponent={
          hasNextPage ? (
            <Button
              label={isFetchingNextPage ? 'Cargando' : 'Ver más'}
              disabled={isFetchingNextPage}
              onPress={() => void fetchNextPage()}
            />
          ) : null
        }
      />
    </View>
  );
}
