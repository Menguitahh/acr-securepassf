import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type GuardToolbarProps = {
  children: ReactNode;
};

// Va en el flujo, no absolute: el contenido de abajo (camara, enrolamiento)
// arranca debajo y nada queda tapado por los botones ni por la status bar.
export function GuardToolbar({ children }: GuardToolbarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row flex-wrap justify-end gap-2 bg-bg-base px-4 pb-2"
      style={{ paddingTop: insets.top + 8 }}
    >
      {children}
    </View>
  );
}
