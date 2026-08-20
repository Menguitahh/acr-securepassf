import { Text, TextInput, View, type TextInputProps } from 'react-native';

type InputProps = TextInputProps & {
  label?: string;
};

export function Input({ label, ...props }: InputProps) {
  return (
    <View className="gap-2">
      {label ? <Text className="text-footnote font-medium text-text-muted">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#71717a"
        className="min-h-12 rounded-xl border border-border bg-bg-elevated px-4 text-body leading-[22px] text-text-primary"
        {...props}
      />
    </View>
  );
}
