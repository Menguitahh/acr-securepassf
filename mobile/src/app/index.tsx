import { Redirect } from 'expo-router';

import { Spinner } from '@/common/components/spinner';
import { hasRole } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';

export default function IndexScreen() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  if (status === 'restoring') return <Spinner />;
  if (status === 'signedOut' || !user) return <Redirect href="/login" />;
  if (hasRole(user, 'GUARD')) return <Redirect href="/(guard)/scanner" />;
  return <Redirect href="/(resident)" />;
}
