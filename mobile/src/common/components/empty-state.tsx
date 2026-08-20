import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-center text-title font-semibold leading-[28px] text-text-primary">
        {title}
      </Text>
      {description ? (
        <Text className="max-w-[300px] text-center text-body leading-[22px] text-text-muted">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-5 w-full max-w-[320px]">
          <Button label={actionLabel} onPress={onAction} variant="primary" />
        </View>
      ) : null}
    </View>
  );
}
