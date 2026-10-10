import { View } from 'react-native';

import { ScreenHeader } from '@/common/components/screen-header';
import { ShiftLogView } from '@/modules/access-log/shift-log-view';

export default function GuardShiftLogScreen() {
  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Registro del turno" back />
      <ShiftLogView />
    </View>
  );
}
