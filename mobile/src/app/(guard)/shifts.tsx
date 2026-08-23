import { View } from 'react-native';

import { ScreenHeader } from '@/common/components/screen-header';
import { ShiftsView } from '@/modules/shifts/shifts-view';

export default function GuardShiftsScreen() {
  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Turno" back />
      <ShiftsView />
    </View>
  );
}
