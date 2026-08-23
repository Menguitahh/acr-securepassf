import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { bindFocusManagerToAppState } from '@/common/query/focus-manager';
import { useSessionStore } from '@/modules/auth/session-store';
import { useRegisterDeviceOnSignIn } from '@/modules/devices/hooks';

import '../global.css';

const queryClient = new QueryClient();

// El aviso local de permanencia (WBS-69) tiene que sonar aunque la app
// este en primer plano: la garita tiene la app abierta todo el turno.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const restore = useSessionStore((state) => state.restore);
  useRegisterDeviceOnSignIn();

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => bindFocusManagerToAppState(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
