import { useState } from 'react';

import { Button } from '@/common/components/button';
import { useLogout } from '@/modules/auth/hooks';

export function LogoutButton() {
  const logout = useLogout();
  const [isPending, setIsPending] = useState(false);

  const onPress = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      await logout();
    } finally {
      // Si el guardia cancelo en el prompt, el boton vuelve a habilitarse
      // para que pueda reintentar. Si cerro, el arbol se desmonta al
      // navegar al login y el estado no importa.
      setIsPending(false);
    }
  };

  return (
    <Button
      label={isPending ? 'Cerrando sesión...' : 'Cerrar sesión'}
      onPress={() => void onPress()}
      disabled={isPending}
    />
  );
}
