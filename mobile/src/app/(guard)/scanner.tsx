import { Text, View } from 'react-native';

import { LogoutButton } from '@/common/components/logout-button';
import { useSessionStore } from '@/modules/auth/session-store';

export default function ScannerScreen() {
  const user = useSessionStore((state) => state.user);

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-bg-base p-6">
      <Text className="text-xl font-semibold text-text-primary">Escaner de QR</Text>
      {user ? <Text className="text-sm text-text-muted">{user.fullName}</Text> : null}
      <LogoutButton />
    </View>
  );
}
