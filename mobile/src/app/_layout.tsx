import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { loadNotifications } from '@/common/notifications';
import { bindFocusManagerToAppState } from '@/common/query/focus-manager';
import { useSessionStore } from '@/modules/auth/session-store';
import { useRegisterDeviceOnSignIn } from '@/modules/devices/hooks';

import '../global.css';

const queryClient = new QueryClient();

export default function RootLayout() {
  const restore = useSessionStore((state) => state.restore);
  useRegisterDeviceOnSignIn();

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => bindFocusManagerToAppState(), []);

  // El aviso local de permanencia (WBS-69) tiene que sonar aunque la app
  // este en primer plano. En Expo Go loadNotifications devuelve null y
  // esto queda en no-op.
  useEffect(() => {
    void loadNotifications().then((N) => {
      N?.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
