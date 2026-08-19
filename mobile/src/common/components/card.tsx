import { View } from 'react-native';

type CardProps = {
  children: React.ReactNode;
};

export function Card({ children }: CardProps) {
  return (
    <View className="rounded-lg border border-border bg-bg-surface p-4">
      {children}
    </View>
  );
}
