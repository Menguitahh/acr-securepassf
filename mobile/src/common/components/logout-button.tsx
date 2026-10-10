import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { Button } from '@/common/components/button';
import { useLogout } from '@/modules/auth/hooks';

type Props = {
  // #232: en el encabezado del guardia, "Salir" chico con borde, separado
  // de las acciones operativas.
  compact?: boolean;
};

export function LogoutButton({ compact = false }: Props) {
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

  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
        accessibilityState={{ disabled: isPending }}
        disabled={isPending}
        onPress={() => void onPress()}
        className="min-h-12 flex-row items-center gap-2 rounded-md border border-border px-3 active:opacity-70 disabled:opacity-40"
      >
        <Ionicons name="log-out-outline" size={20} color="#a1a1aa" />
        <Text className="text-base font-semibold text-text-muted">{isPending ? 'Saliendo...' : 'Salir'}</Text>
      </Pressable>
    );
  }

  return (
    <Button
      label={isPending ? 'Cerrando sesión...' : 'Cerrar sesión'}
      onPress={() => void onPress()}
      disabled={isPending}
    />
  );
}
