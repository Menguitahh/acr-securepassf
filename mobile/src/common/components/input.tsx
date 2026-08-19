import { Text, TextInput, View, type TextInputProps } from 'react-native';

type InputProps = TextInputProps & {
  label?: string;
};

export function Input({ label, ...props }: InputProps) {
  return (
    <View className="gap-2">
      {label ? <Text className="text-sm text-text-muted">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#a1a1aa"
        className="min-h-12 rounded-xl border border-border bg-bg-elevated px-4 text-base text-text-primary"
        {...props}
      />
    </View>
  );
}
