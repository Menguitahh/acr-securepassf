import { View } from 'react-native';

import { DateField } from '@/common/components/date-field';

type Props = {
  from: Date | null;
  until: Date | null;
  onChangeFrom: (date: Date) => void;
  onChangeUntil: (date: Date) => void;
  disabled?: boolean;
};

// Dos time pickers en fila. La validacion de orden (dailyUntil > dailyFrom)
// vive en validateWorkerForm — aca solo se muestran los inputs. Simetria con
// AddPersonModal, donde el error del form aparece debajo del formulario, no
// pegado al field.
export function TimeRangeField({
  from,
  until,
  onChangeFrom,
  onChangeUntil,
  disabled,
}: Props) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <DateField
          label="Desde"
          value={from}
          onChange={onChangeFrom}
          mode="time"
          disabled={disabled ?? false}
        />
      </View>
      <View className="flex-1">
        <DateField
          label="Hasta"
          value={until}
          onChange={onChangeUntil}
          mode="time"
          disabled={disabled ?? false}
        />
      </View>
    </View>
  );
}
