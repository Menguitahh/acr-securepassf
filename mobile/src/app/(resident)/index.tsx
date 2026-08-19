import { Text, View } from 'react-native';

import { LogoutButton } from '@/common/components/logout-button';

export default function ResidentHomeScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-bg-base p-6">
      <Text className="text-xl font-semibold text-text-primary">
        Home del residente
      </Text>
      <LogoutButton />
    </View>
  );
}
