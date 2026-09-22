import { Pressable, Text, View } from 'react-native';

import { WEEKDAY_LABELS } from '@/modules/worker/data';

type Props = {
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
};

export function WeekdayPicker({ value, onChange, disabled }: Props) {
  const toggle = (iso: number) => {
    if (disabled) return;
    if (value.includes(iso)) {
      onChange(value.filter((d) => d !== iso));
    } else {
      onChange([...value, iso].sort((a, b) => a - b));
    }
  };

  return (
    <View className="flex-row gap-2">
      {WEEKDAY_LABELS.map(({ iso, label }) => {
        const active = value.includes(iso);
        return (
          <Pressable
            key={iso}
            accessibilityRole="button"
            accessibilityLabel={`Dia ${iso}`}
            accessibilityState={{ selected: active, disabled: disabled ?? false }}
            onPress={() => toggle(iso)}
            disabled={disabled ?? false}
            className={`h-12 w-12 items-center justify-center rounded-md active:opacity-70 disabled:opacity-40 ${
              active ? 'bg-text-primary' : 'border border-border bg-bg-elevated'
            }`}
          >
            <Text
              className={`text-body font-semibold ${
                active ? 'text-bg-base' : 'text-text-muted'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
