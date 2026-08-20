import { Pressable, View } from 'react-native';

type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
};

export function Card({ children, onPress }: CardProps) {
  if (!onPress) {
    return <View className="rounded-lg border border-border bg-bg-surface p-5">{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-lg border border-border bg-bg-surface p-5 active:opacity-70"
    >
      {children}
    </Pressable>
  );
}
