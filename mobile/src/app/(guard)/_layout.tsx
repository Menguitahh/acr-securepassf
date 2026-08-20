import { Redirect, Stack } from 'expo-router';

import { Spinner } from '@/common/components/spinner';
import { hasRole } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';

export default function GuardLayout() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  if (status === 'restoring') return <Spinner />;
  if (status === 'signedOut' || !user || !hasRole(user, 'GUARD')) {
    return <Redirect href="/login" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
