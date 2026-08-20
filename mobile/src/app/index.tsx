import { Redirect } from 'expo-router';

import { Spinner } from '@/common/components/spinner';
import { homeRouteFor } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';

export default function IndexScreen() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  if (status === 'restoring') return <Spinner />;
  return <Redirect href={homeRouteFor(user)} />;
}
