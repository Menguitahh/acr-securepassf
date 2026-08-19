import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Card } from '@/common/components/card';
import { EmptyState } from '@/common/components/empty-state';
import { ErrorState } from '@/common/components/error-state';
import { LogoutButton } from '@/common/components/logout-button';
import { Spinner } from '@/common/components/spinner';
import { TYPE_LABELS } from '@/modules/invitation/data';
import { useActiveInvitations } from '@/modules/invitation/hooks';
import { formatWindow, remainingUses } from '@/modules/invitation/lib';
import { useSessionStore } from '@/modules/auth/session-store';

export default function ResidentHomeScreen() {
  const { data, isLoading, isError, error, refetch } = useActiveInvitations();
  const router = useRouter();
  const user = useSessionStore((state) => state.user);

  if (isError) {
    return (
      <View className="flex-1 bg-bg-base">
        <HomeHeader name={user?.fullName} />
        <ErrorState
          message={`${error instanceof Error ? error.message : 'No se pudo cargar la lista de pases.'} Reintentá en unos segundos.`}
        />
        <View className="p-6">
          <Button label="Reintentar" onPress={() => void refetch()} />
        </View>
      </View>
    );
  }
  if (isLoading) return <View className="flex-1 bg-bg-base"><Spinner /></View>;
  if (!data?.length) {
    return (
      <View className="flex-1 bg-bg-base">
        <HomeHeader name={user?.fullName} />
        <EmptyState title="No tenés pases activos." />
      </View>
    );
  }

  return (
    <View className="flex-1 gap-4 bg-bg-base p-4">
      <HomeHeader name={user?.fullName} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id ?? ''}
        contentContainerClassName="gap-3"
        renderItem={({ item }) => (
          <Card>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-base font-semibold text-text-primary">
                {item.guestName ?? 'Sin nombre'}
              </Text>
              <Text className="text-sm text-text-muted">
                {item.type ? TYPE_LABELS[item.type] : ''}
              </Text>
            </View>
            <Text className="mt-1 text-sm text-text-muted">
              {formatWindow(item.validFrom, item.validUntil)}
            </Text>
            {remainingUses(item) !== null ? (
              <Text className="mt-1 text-sm text-text-muted">
                Usos restantes: {remainingUses(item)}
              </Text>
            ) : null}
          </Card>
        )}
      />
      <Button
        label="Mi QR"
        onPress={() => router.push('/(resident)/qr-personal')}
      />
    </View>
  );
}

function HomeHeader({ name }: { name: string | undefined }) {
  return (
    <View className="flex-row items-center justify-between p-4">
      <View>
        <Text className="text-xl font-semibold text-text-primary">Invitaciones</Text>
        {name ? <Text className="text-sm text-text-muted">{name}</Text> : null}
      </View>
      <LogoutButton />
    </View>
  );
}
