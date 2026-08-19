import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useSessionStore } from '@/modules/auth/session-store';

import '../global.css';

export default function RootLayout() {
  const restore = useSessionStore((state) => state.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
