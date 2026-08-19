import { Text, View } from 'react-native';

type ErrorStateProps = {
  message: string;
};

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-6">
      <Text className="text-center text-base text-text-primary">{message}</Text>
    </View>
  );
}
