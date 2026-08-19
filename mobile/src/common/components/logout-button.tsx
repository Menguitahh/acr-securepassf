import { Button } from '@/common/components/button';
import { useLogout } from '@/modules/auth/hooks';

export function LogoutButton() {
  const logout = useLogout();

  return <Button label="Cerrar sesion" onPress={() => void logout()} />;
}
