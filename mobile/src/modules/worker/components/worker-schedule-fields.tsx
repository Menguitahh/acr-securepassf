import { Text, View } from 'react-native';

import { Input } from '@/common/components/input';
import { TimeRangeField } from '@/modules/worker/components/time-range-field';
import { WeekdayPicker } from '@/modules/worker/components/weekday-picker';

type Props = {
  service: string;
  onChangeService: (next: string) => void;
  weekdays: number[];
  onChangeWeekdays: (next: number[]) => void;
  from: Date | null;
  until: Date | null;
  onChangeFrom: (date: Date) => void;
  onChangeUntil: (date: Date) => void;
  disabled?: boolean;
};

// Bloque comun a alta y edicion: servicio + dias + horario. Cambios de layout
// o tokens tienen que valer para los dos flujos, por eso vive aca.
export function WorkerScheduleFields({
  service,
  onChangeService,
  weekdays,
  onChangeWeekdays,
  from,
  until,
  onChangeFrom,
  onChangeUntil,
  disabled,
}: Props) {
  return (
    <>
      <View className="gap-3">
        <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
          Servicio
        </Text>
        <Input
          label="Servicio (ej. jardineria, plomeria)"
          value={service}
          onChangeText={onChangeService}
          editable={!disabled}
        />
      </View>

      <View className="gap-3">
        <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
          Días de la semana
        </Text>
        <WeekdayPicker value={weekdays} onChange={onChangeWeekdays} disabled={disabled ?? false} />
      </View>

      <View className="gap-3">
        <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
          Horario
        </Text>
        <TimeRangeField
          from={from}
          until={until}
          onChangeFrom={onChangeFrom}
          onChangeUntil={onChangeUntil}
          disabled={disabled ?? false}
        />
      </View>
    </>
  );
}
