import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string | undefined;
  back?: boolean | undefined;
  right?: ReactNode | undefined;
};

export function ScreenHeader({ title, subtitle, back = false, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(resident)');
  };

  return (
    <View
      className="flex-row items-center justify-between px-6 pb-2"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-1">
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={handleBack}
            hitSlop={12}
            className="-ml-2 mb-1 min-h-12 min-w-12 flex-row items-center gap-1 self-start pr-3 active:opacity-60"
          >
            <Ionicons name="chevron-back" size={22} color="#fafafa" />
            <Text className="text-body text-text-primary">Volver</Text>
          </Pressable>
        ) : null}
        <Text className="text-large-title font-bold leading-[41px] tracking-[-0.4px] text-text-primary">
          {title}
        </Text>
        {subtitle ? <Text className="mt-1 text-footnote text-text-muted">{subtitle}</Text> : null}
      </View>
      {right ?? null}
    </View>
  );
}
