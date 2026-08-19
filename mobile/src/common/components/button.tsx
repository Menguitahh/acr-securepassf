import { Pressable, Text } from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function Button({ label, onPress, disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-12 items-center justify-center rounded-md bg-bg-elevated px-4 active:opacity-70 disabled:opacity-40"
    >
      <Text className="text-base font-semibold text-text-primary">{label}</Text>
    </Pressable>
  );
}
