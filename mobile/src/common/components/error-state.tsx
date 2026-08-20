import { Text } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

type ErrorStateProps = {
  message: string;
};

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(350).reduceMotion(ReduceMotion.System)}
      className="flex-1 items-center justify-center gap-3 px-8"
    >
      <Text className="text-center text-title font-semibold leading-[28px] text-text-primary">
        No se pudo cargar.
      </Text>
      <Text className="max-w-[300px] text-center text-body leading-[22px] text-text-muted">
        {message}
      </Text>
    </Animated.View>
  );
}
