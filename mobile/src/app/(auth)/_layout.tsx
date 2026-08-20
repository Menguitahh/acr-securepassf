import { Redirect, Stack } from 'expo-router';

import { Spinner } from '@/common/components/spinner';
import { hasMobileRole } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';

export default function AuthLayout() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  if (status === 'restoring') return <Spinner />;
  // Solo rebota al home a quien tiene pantalla en la app mobile. Una
  // sesion sin rol mobile (ADMIN) queda en el login: es estado terminal.
  if (status === 'signedIn' && user && hasMobileRole(user)) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
