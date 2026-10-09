import { isResident } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';
import { useStayWarningActions } from '@/modules/resident-stays/hooks';

// #33: va en el layout raiz, dentro del QueryClientProvider. El push puede
// llegar con el residente en cualquier pantalla: el listener no puede vivir
// en un layout que se desmonta al navegar.
export function StayWarningActions() {
  const user = useSessionStore((state) => state.user);
  const status = useSessionStore((state) => state.status);
  useStayWarningActions(status === 'signedIn' && user !== null && isResident(user));
  return null;
}
