import { View } from 'react-native';

import { ScreenHeader } from '@/common/components/screen-header';
import { ManualAccessView } from '@/modules/manual-access/manual-access-view';

export default function GuardManualAccessScreen() {
  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Ingreso manual" back />
      <ManualAccessView />
    </View>
  );
}
