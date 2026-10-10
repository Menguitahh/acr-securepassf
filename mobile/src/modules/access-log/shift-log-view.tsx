import { FlatList, View } from 'react-native';

import { Button } from '@/common/components/button';
import { EmptyState } from '@/common/components/empty-state';
import { ErrorState } from '@/common/components/error-state';
import { Spinner } from '@/common/components/spinner';
import { AccessLogRow } from '@/modules/access-log/components/access-log-row';
import { useShiftLog } from '@/modules/access-log/hooks';

// US-72: registro del turno. Hora, nombre, lote, direccion y resultado; los
// denegados con su motivo.
export function ShiftLogView() {
  const { data, dataUpdatedAt, isLoading, isError, error, refetch } = useShiftLog();

  if (isError && data === undefined) {
    return (
      <View className="flex-1 bg-bg-base">
        <ErrorState
          message={`${error instanceof Error ? error.message : 'No se pudo cargar el registro.'} Reintentá en unos segundos.`}
        />
        <View className="px-6 pb-6">
          <Button label="Reintentar" variant="primary" onPress={() => void refetch()} />
        </View>
      </View>
    );
  }
  if (isLoading) return <Spinner />;
  if (!data?.length) {
    return (
      <EmptyState
        title="Todavía no hay movimientos en tu turno."
        description="Los ingresos y egresos que registres van a aparecer acá."
      />
    );
  }
  const now = new Date(dataUpdatedAt);
  return (
    <FlatList
      data={data}
      keyExtractor={(item, index) => item.id ?? String(index)}
      contentContainerClassName="gap-3 px-6 pb-6"
      renderItem={({ item }) => <AccessLogRow item={item} now={now} />}
    />
  );
}
