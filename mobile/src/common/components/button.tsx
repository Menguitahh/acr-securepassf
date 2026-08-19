import { Pressable, Text } from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
};

export function Button({ label, onPress, disabled = false, selected = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-md px-4 active:opacity-70 disabled:opacity-40 ${selected ? 'bg-text-primary' : 'bg-bg-elevated'}`}
    >
      <Text className={`text-base font-semibold ${selected ? 'text-bg-base' : 'text-text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
