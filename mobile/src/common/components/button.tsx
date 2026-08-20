import * as Haptics from 'expo-haptics';
import { Pressable, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  variant?: 'primary' | 'secondary';
};

const PRESSED_SCALE = 0.96;
const SPRING = { damping: 18, stiffness: 400 };

export function Button({
  label,
  onPress,
  disabled = false,
  selected = false,
  variant = 'secondary',
}: ButtonProps) {
  const scale = useSharedValue(1);
  const isPrimary = variant === 'primary';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    // La regla react-hooks/immutability no entiende el patron de shared
    // values de reanimated: .value es mutable por diseño.
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSpring(PRESSED_SCALE, SPRING);
    if (isPrimary) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSpring(1, SPRING);
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className={`min-h-12 items-center justify-center rounded-md px-4 active:opacity-70 disabled:opacity-40 ${isPrimary || selected ? 'bg-text-primary' : 'bg-bg-elevated'}`}
      >
        <Text
          className={`text-base font-semibold ${isPrimary || selected ? 'text-bg-base' : 'text-text-primary'}`}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
