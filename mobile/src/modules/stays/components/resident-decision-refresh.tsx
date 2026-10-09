import { hasRole } from '@/modules/auth/lib';
import { useSessionStore } from '@/modules/auth/session-store';
import { useRefreshOnResidentDecision } from '@/modules/stays/hooks';

// #33: en el layout raiz, como StayWarningActions: el push llega con el
// guardia en cualquier pantalla (scanner, turno, presentes).
export function ResidentDecisionRefresh() {
  const user = useSessionStore((state) => state.user);
  const status = useSessionStore((state) => state.status);
  useRefreshOnResidentDecision(status === 'signedIn' && user !== null && hasRole(user, 'GUARD'));
  return null;
}
