import { Redirect, Stack } from 'expo-router';

import { Spinner } from '@/common/components/spinner';
import { useSessionStore } from '@/modules/auth/session-store';

export default function AuthLayout() {
  const status = useSessionStore((state) => state.status);

  if (status === 'restoring') return <Spinner />;
  if (status === 'signedIn') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
