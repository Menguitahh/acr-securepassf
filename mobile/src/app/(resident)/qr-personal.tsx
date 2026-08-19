import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';

// ponytail: espera el endpoint del pase personal (backend WBS-21). Cuando
// exista, reemplazar este mensaje por el QR del pase del residente.
export default function PersonalQrScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-bg-base p-6">
      <Text className="text-xl font-semibold text-text-primary">Mi QR</Text>
      <Text className="text-center text-base text-text-muted">
        Tu pase personal todavia no esta disponible. Lo vas a encontrar aca
        cuando se active.
      </Text>
      <Button label="Volver" onPress={() => router.back()} />
    </View>
  );
}
