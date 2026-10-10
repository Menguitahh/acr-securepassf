import { Text, View } from 'react-native';

import { describeAccessLog, formatLogTime } from '@/modules/access-log/lib';
import type { AccessLogItem } from '@/modules/access-log/types';

type Props = { item: AccessLogItem; now: Date };

export function AccessLogRow({ item, now }: Props) {
  const row = describeAccessLog(item);
  return (
    <View className="gap-1 rounded-lg border border-border bg-bg-surface p-4">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-body font-semibold text-text-primary">{row.title}</Text>
        <Text className="text-footnote text-text-muted">{formatLogTime(item.capturedAt, now)}</Text>
      </View>
      <Text className="text-footnote text-text-muted">{row.detail}</Text>
      <Text className={`text-footnote font-semibold ${row.denied ? 'text-text-primary' : 'text-text-muted'}`}>
        {row.outcome}
      </Text>
    </View>
  );
}
