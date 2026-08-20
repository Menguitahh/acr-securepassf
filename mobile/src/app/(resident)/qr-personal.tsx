import { Text, View } from 'react-native';

import { ScreenHeader } from '@/common/components/screen-header';

// ponytail: espera el endpoint del pase personal (backend WBS-21). Cuando
// exista, reemplazar este placeholder por el QR del pase del residente,
// con la misma jerarquia de la pantalla de pase: QR grande centrado.
export default function PersonalQrScreen() {
  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Mi QR" back />
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-center text-title font-semibold leading-[28px] text-text-primary">
          Tu pase personal todavia no esta disponible.
        </Text>
        <Text className="max-w-[300px] text-center text-body leading-[22px] text-text-muted">
          Lo vas a encontrar aca cuando se active. Por ahora, los invitados entran con los
          pases que creas.
        </Text>
      </View>
    </View>
  );
}
