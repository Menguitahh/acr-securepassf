import { Redirect, Stack } from 'expo-router';

import { Spinner } from '@/common/components/spinner';
import { isResident } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';
import { STACK_SCREEN_OPTIONS } from '@/common/navigation/stack-options';

export default function ResidentLayout() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  if (status === 'restoring') return <Spinner />;
  if (status === 'signedOut' || !user || !isResident(user)) {
    return <Redirect href="/login" />;
  }

  return <Stack screenOptions={{ ...STACK_SCREEN_OPTIONS, animation: 'slide_from_right' }} />;
}
