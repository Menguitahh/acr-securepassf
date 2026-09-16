import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Platform, Text, View } from 'react-native';

import { Button } from './button';
import { formatDateFieldValue, type DateFieldMode } from './date-field-format';

export { formatDateFieldValue, type DateFieldMode };

type Props = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  mode: DateFieldMode;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
};

export function DateField({
  label,
  value,
  onChange,
  mode,
  minimumDate,
  maximumDate,
  disabled,
}: Props) {
  if (Platform.OS === 'android') {
    const openPicker = () => {
      const current = value ?? new Date();
      // Android imperative API no soporta mode 'datetime': encadenar date y time
      // como hace el wrapper declarativo internamente.
      //
      // Granularidad del clamp: minimumDate/maximumDate se pasan al step de
      // FECHA pero NO al de HORA. Consecuencia deliberada: en Android el
      // clamp opera a granularidad de dia (bloquea "ayer" pero permite
      // "hoy 14:00" cuando son las 15:00). En iOS el picker declarativo
      // usa el timestamp entero y bloquea el minuto pasado. Se acepta la
      // diferencia porque un pase que arranca "hoy hace una hora" es un
      // caso legitimo (invitado ya llego, residente cargando tarde), no un
      // typo; y meter mas logica en este encadenamiento aumenta la
      // superficie de bugs de un componente que ya rompimos una vez
      // (#92: firma de onValueChange).
      if (mode === 'datetime') {
        DateTimePickerAndroid.open({
          value: current,
          mode: 'date',
          ...(minimumDate ? { minimumDate } : {}),
          ...(maximumDate ? { maximumDate } : {}),
          // onValueChange solo dispara en confirm (la lib filtra dismissed
          // antes de llamar) y su event no trae .type — no reintroducir el
          // guard event.type === 'set', queda siempre false.
          onValueChange: (_, dateSelected) => {
            if (!dateSelected) return;
            DateTimePickerAndroid.open({
              value: dateSelected,
              mode: 'time',
              // Ver comentario arriba: onValueChange sin guard de .type.
              onValueChange: (__, timeSelected) => {
                if (timeSelected) onChange(timeSelected);
              },
            });
          },
        });
        return;
      }
      DateTimePickerAndroid.open({
        value: current,
        mode,
        ...(minimumDate ? { minimumDate } : {}),
        ...(maximumDate ? { maximumDate } : {}),
        // onValueChange solo dispara en confirm (la lib filtra dismissed
        // antes de llamar) y su event no trae .type — no reintroducir el
        // guard event.type === 'set', queda siempre false.
        onValueChange: (_, selected) => {
          if (selected) onChange(selected);
        },
      });
    };
    return (
      <View className="gap-2">
        <Text className="text-footnote font-medium text-text-muted">{label}</Text>
        <Button
          label={formatDateFieldValue(value, mode)}
          onPress={openPicker}
          disabled={disabled ?? false}
        />
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-footnote font-medium text-text-muted">{label}</Text>
      <DateTimePicker
        value={value ?? new Date()}
        mode={mode}
        {...(minimumDate ? { minimumDate } : {})}
        {...(maximumDate ? { maximumDate } : {})}
        // onValueChange solo dispara en confirm y su event no trae .type —
        // no reintroducir el guard event.type === 'set', queda siempre false.
        onValueChange={(_, selected) => {
          if (selected) onChange(selected);
        }}
        textColor="#fafafa"
        accentColor="#fafafa"
      />
    </View>
  );
}
