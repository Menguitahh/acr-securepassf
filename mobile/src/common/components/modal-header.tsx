import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ModalHeaderProps = {
  title: ReactNode;
  onClose: () => void;
};

// Encabezado de los modales de pantalla completa. En Android edge-to-edge el
// Modal dibuja debajo de la status bar: sin el inset el titulo y "Cerrar" se
// pisaban con la hora y la bateria. "Cerrar" con 48 dp (se opera con guantes).
export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center justify-between border-b border-border px-6 pb-2"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Text className="flex-1 text-title font-semibold text-text-primary">{title}</Text>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        className="min-h-12 min-w-12 items-end justify-center active:opacity-60"
      >
        <Text className="text-body text-text-muted">Cerrar</Text>
      </Pressable>
    </View>
  );
}
