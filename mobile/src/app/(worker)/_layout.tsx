import { Redirect, Stack } from 'expo-router';

import { Spinner } from '@/common/components/spinner';
import { isWorker } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';
import { STACK_SCREEN_OPTIONS } from '@/common/navigation/stack-options';

export default function WorkerLayout() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  if (status === 'restoring') return <Spinner />;
  if (status === 'signedOut' || !user || !isWorker(user)) return <Redirect href="/login" />;

  return <Stack screenOptions={STACK_SCREEN_OPTIONS} />;
}
