import { Text, View } from 'react-native';

type ErrorStateProps = {
  message: string;
};

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-center text-title font-semibold leading-[28px] text-text-primary">
        No se pudo cargar.
      </Text>
      <Text className="max-w-[300px] text-center text-body leading-[22px] text-text-muted">
        {message}
      </Text>
    </View>
  );
}
