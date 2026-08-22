import { View } from 'react-native';

import { ScreenHeader } from '@/common/components/screen-header';
import { StaysView } from '@/modules/stays/stays-view';

export default function GuardStaysScreen() {
  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Presentes ahora" back />
      <StaysView />
    </View>
  );
}
