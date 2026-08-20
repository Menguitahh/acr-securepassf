import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/common/components/button';
import { Card } from '@/common/components/card';
import { EmptyState } from '@/common/components/empty-state';
import { ErrorState } from '@/common/components/error-state';
import { LogoutButton } from '@/common/components/logout-button';
import { ScreenHeader } from '@/common/components/screen-header';
import { Spinner } from '@/common/components/spinner';
import { TYPE_LABELS } from '@/modules/invitation/data';
import { useActiveInvitations } from '@/modules/invitation/hooks';
import { formatWindow, remainingUses } from '@/modules/invitation/lib';
import { useSessionStore } from '@/modules/auth/session-store';

export default function ResidentHomeScreen() {
  const { data, isLoading, isError, error, refetch } = useActiveInvitations();
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const insets = useSafeAreaInsets();

  if (isError) {
    return (
      <View className="flex-1 bg-bg-base">
        <ScreenHeader title="Invitaciones" subtitle={user?.fullName} />
        <ErrorState
          message={`${error instanceof Error ? error.message : 'No se pudo cargar la lista de pases.'} Reintentá en unos segundos.`}
        />
        <View className="gap-3 px-8 pb-8">
          <Button label="Reintentar" onPress={() => void refetch()} variant="primary" />
          <LogoutButton />
        </View>
      </View>
    );
  }
  if (isLoading) return <View className="flex-1 bg-bg-base"><Spinner /></View>;
  if (!data?.length) {
    return (
      <View className="flex-1 bg-bg-base">
        <ScreenHeader title="Invitaciones" subtitle={user?.fullName} />
        <EmptyState
          title="No tenés pases activos."
          description="Creá un pase para un invitado y compartile el QR para entrar al barrio."
          actionLabel="Crear invitación"
          onAction={() => router.push('/(resident)/create')}
        />
        <View className="px-8 pb-10">
          <LogoutButton />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Invitaciones" subtitle={user?.fullName} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id ?? ''}
        contentContainerClassName="gap-3 px-6"
        ListFooterComponent={
          <View className="gap-3 pb-10 pt-8">
            <Button
              label="Crear invitación"
              onPress={() => router.push('/(resident)/create')}
              variant="primary"
            />
            <Button label="Mi QR" onPress={() => router.push('/(resident)/qr-personal')} />
            <LogoutButton />
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(Math.min(index * 60, 300))}
          >
            <Card onPress={() => router.push({ pathname: '/(resident)/invitation/[id]', params: { id: item.id ?? '' } })}>
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-body font-semibold leading-[22px] text-text-primary">
                  {item.guestName ?? 'Sin nombre'}
                </Text>
                {item.type ? (
                  <Text className="rounded-full bg-bg-elevated px-2.5 py-1 text-footnote text-text-muted">
                    {TYPE_LABELS[item.type]}
                  </Text>
                ) : null}
              </View>
              <Text className="mt-3 text-footnote leading-[18px] text-text-muted">
                {formatWindow(item.validFrom, item.validUntil)}
              </Text>
              {remainingUses(item) !== null ? (
                <Text className="mt-1 text-footnote leading-[18px] text-text-muted">
                  Usos restantes: {remainingUses(item)}
                </Text>
              ) : null}
            </Card>
          </Animated.View>
        )}
        style={{ flex: 1, paddingBottom: insets.bottom }}
      />
    </View>
  );
}
