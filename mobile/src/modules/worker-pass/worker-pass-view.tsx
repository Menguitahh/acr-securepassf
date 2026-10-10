import { ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/common/components/button';
import { EmptyState } from '@/common/components/empty-state';
import { ErrorState } from '@/common/components/error-state';
import { LogoutButton } from '@/common/components/logout-button';
import { ScreenHeader } from '@/common/components/screen-header';
import { Spinner } from '@/common/components/spinner';
import { isResident } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';
import { formatSchedule } from '@/modules/worker/lib';
import { useWorkerQr } from '@/modules/worker-pass/hooks';

const QR_SIZE = 280;

// US-65: pantalla unica. Nombre, QR grande y las casas donde trabaja con su
// horario. Nada mas del barrio.
export function WorkerPassView() {
  const user = useSessionStore((state) => state.user);
  const { data, isLoading, isError, refetch } = useWorkerQr();
  const lots = (user?.lots ?? []).filter((lot) => lot.kind === 'WORKER');

  // Residente que ademas trabaja: llega desde su home y vuelve ahi. El
  // trabajador solo tiene esta pantalla: cierra sesion desde aca.
  const header =
    user && isResident(user) ? (
      <ScreenHeader title="Mi QR de trabajo" back />
    ) : (
      <ScreenHeader title="Mi QR" right={<LogoutButton />} />
    );

  if (isError && data === undefined) {
    return (
      <View className="flex-1 bg-bg-base">
        {header}
        <ErrorState message="No se pudo cargar tu QR. Revisá la conexión y volvé a abrir la app." />
        <View className="px-6 pb-6">
          <Button label="Reintentar" variant="primary" onPress={() => void refetch()} />
        </View>
      </View>
    );
  }
  if (isLoading) {
    return (
      <View className="flex-1 bg-bg-base">
        {header}
        <Spinner />
      </View>
    );
  }
  if (!data) {
    return (
      <View className="flex-1 bg-bg-base">
        {header}
        <EmptyState
          title="No tenés trabajos habilitados."
          description="Pedile al titular de la casa que te habilite con tus días y horarios."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-base">
      {header}
      <ScrollView contentContainerClassName="items-center gap-6 px-6 pb-8">
        <Text className="text-2xl font-semibold text-text-primary">{user?.fullName ?? ''}</Text>
        <View className="items-center rounded-2xl bg-[#fafafa] p-6">
          <QRCode value={data.token} size={QR_SIZE} />
        </View>
        <Text className="text-center text-body text-text-muted">
          Mostralo en la garita. Sirve en todas las casas donde trabajás, en tu horario.
        </Text>
        <View className="w-full gap-3">
          {lots.map((lot) => (
            <View key={lot.id ?? lot.code} className="rounded-lg border border-border bg-bg-surface p-4">
              <Text className="text-body font-semibold text-text-primary">
                Lote {lot.code ?? ''}
                {lot.service ? ` · ${lot.service}` : ''}
              </Text>
              <Text className="text-footnote text-text-muted">
                {formatSchedule(lot.schedule?.weekdays, lot.schedule?.dailyFrom, lot.schedule?.dailyUntil)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
