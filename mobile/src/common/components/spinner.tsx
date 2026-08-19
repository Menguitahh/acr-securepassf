import { ActivityIndicator, View } from 'react-native';

export function Spinner() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color="#fafafa" size="large" />
    </View>
  );
}
