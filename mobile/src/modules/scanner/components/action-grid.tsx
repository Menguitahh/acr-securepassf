import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import { ACTION_GRID_GAP, ACTION_TILE_HEIGHT } from '@/modules/scanner/data';
import { actionGridColumns } from '@/modules/scanner/lib';

export type GuardAction = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

type Props = {
  actions: readonly GuardAction[];
  // Ancho util del contenedor (pantalla menos el padding lateral).
  horizontalPadding: number;
};

// Acciones frecuentes del guardia: todas las celdas miden lo mismo, sin
// importar el texto. 2 columnas en telefono, 4 en tablet u horizontal. El
// texto largo pasa a 2 lineas o achica un poco la letra, nunca deforma la
// celda.
export function ActionGrid({ actions, horizontalPadding }: Props) {
  const { width } = useWindowDimensions();
  const columns = actionGridColumns(width);
  const available = width - horizontalPadding * 2;
  const tileWidth = Math.floor((available - ACTION_GRID_GAP * (columns - 1)) / columns);

  return (
    <View className="flex-row flex-wrap" style={{ gap: ACTION_GRID_GAP }}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={{ width: tileWidth, height: ACTION_TILE_HEIGHT }}
          className="flex-row items-center gap-3 rounded-md border border-border bg-bg-elevated px-3 active:opacity-70"
        >
          <Ionicons name={action.icon} size={24} color="#fafafa" />
          <Text
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            className="flex-1 text-base font-semibold leading-5 text-text-primary"
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
