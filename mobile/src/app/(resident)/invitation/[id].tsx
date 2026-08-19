import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/common/components/button';
import { ErrorState } from '@/common/components/error-state';
import { Spinner } from '@/common/components/spinner';
import { useInvitation } from '@/modules/invitation/hooks';
import { formatWindow } from '@/modules/invitation/lib';

export default function InvitationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, error } = useInvitation(id);
  const router = useRouter();

  if (isError) {
    return (
      <View className="flex-1 bg-bg-base">
        <ErrorState
          message={`${error instanceof Error ? error.message : 'No se pudo cargar el pase.'} Volvé e intentá de nuevo.`}
        />
        <View className="p-6">
          <Button label="Volver" onPress={() => router.back()} />
        </View>
      </View>
    );
  }
  if (isLoading) return <View className="flex-1 bg-bg-base"><Spinner /></View>;

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-bg-base p-6">
      <Text className="text-xl font-semibold text-text-primary">
        {data?.guestName ?? 'Invitación'}
      </Text>
      <Text className="text-sm text-text-muted">
        {formatWindow(data?.validFrom, data?.validUntil)}
      </Text>
      {data?.status === 'ACTIVE' && data.qrToken ? (
        <View className="rounded-lg bg-text-primary p-4">
          <QRCode value={data.qrToken} size={240} />
        </View>
      ) : (
        <Text className="text-center text-base text-text-primary">
          El pase no esta activo y no se puede escanear.
        </Text>
      )}
      <Button label="Volver" onPress={() => router.back()} />
    </View>
  );
}
