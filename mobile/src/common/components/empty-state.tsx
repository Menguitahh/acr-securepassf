import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';

type EmptyStateProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-6">
      <Text className="text-center text-base text-text-muted">{title}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}
