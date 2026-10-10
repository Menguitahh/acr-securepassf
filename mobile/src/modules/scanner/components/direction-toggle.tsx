import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import { DIRECTION_OPTIONS } from '@/modules/scanner/data';
import type { Direction } from '@/modules/scanner/types';

type Props = {
  value: Direction;
  onChange: (direction: Direction) => void;
};

// Accion principal del guardia: que registra el proximo QR. Excepcion
// documentada a la regla monocromatica (spec 9.1): el modo activo lleva el
// color del resultado (verde ingreso, ambar egreso) con texto oscuro, que
// pasa contraste AA sobre los dos. Tambien cambia el icono y el texto, asi
// no depende solo del color.
export function DirectionToggle({ value, onChange }: Props) {
  return (
    <View accessibilityRole="radiogroup" className="h-16 flex-row gap-2 rounded-lg bg-bg-surface p-1">
      {DIRECTION_OPTIONS.map((option) => {
        const selected = option.value === value;
        const activeBg = option.value === 'IN' ? 'bg-allow' : 'bg-warn';
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Registrar ${option.label.toLowerCase()}`}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-md active:opacity-80 ${
              selected ? activeBg : 'bg-transparent'
            }`}
          >
            <Ionicons name={option.icon} size={24} color={selected ? '#09090b' : '#a1a1aa'} />
            <Text className={`text-body font-bold ${selected ? 'text-bg-base' : 'text-text-muted'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
