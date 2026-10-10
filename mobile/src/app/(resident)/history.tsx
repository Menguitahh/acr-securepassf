import { View } from 'react-native';

import { ScreenHeader } from '@/common/components/screen-header';
import { HistoryView } from '@/modules/access-log/history-view';

export default function ResidentHistoryScreen() {
  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Historial de accesos" back />
      <HistoryView />
    </View>
  );
}
