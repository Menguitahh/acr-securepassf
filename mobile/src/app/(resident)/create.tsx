import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { useSessionStore } from '@/modules/auth/session-store';
import { useCreateInvitation } from '@/modules/invitation/hooks';
import {
  validateInvitationForm,
  type InvitationFormValues,
} from '@/modules/invitation/lib';

const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miercoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sabado' },
  { value: 7, label: 'Domingo' },
];

function defaultWindow(): { from: Date; until: Date } {
  const from = new Date();
  from.setHours(from.getHours() + 1, 0, 0, 0);
  const until = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, until };
}

export default function CreateInvitationScreen() {
  const router = useRouter();
  const lots = useSessionStore((state) => state.user?.lots) ?? [];
  const invitableLots = lots.filter((lot) => lot.canInvite !== false);
  const { from: defaultFrom, until: defaultUntil } = defaultWindow();

  const [values, setValues] = useState<InvitationFormValues>(() => ({
    lotId: invitableLots.length === 1 ? (invitableLots[0]?.id ?? null) : null,
    type: 'SINGLE',
    guestName: '',
    guestDocument: '',
    companions: '',
    validFrom: defaultFrom,
    validUntil: defaultUntil,
    maxUses: '',
    weekdays: [],
    dailyFrom: new Date(new Date().setHours(8, 0, 0, 0)),
    dailyUntil: new Date(new Date().setHours(18, 0, 0, 0)),
  }));
  const [showFrom, setShowFrom] = useState(false);
  const [showUntil, setShowUntil] = useState(false);
  const [showDailyFrom, setShowDailyFrom] = useState(false);
  const [showDailyUntil, setShowDailyUntil] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { mutate, isPending, error } = useCreateInvitation();

  if (invitableLots.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg-base p-6">
        <Text className="text-center text-base text-text-primary">
          No tenés lotes habilitados para invitar. Pedí al titular de tu
          unidad familiar que te habilite.
        </Text>
        <Button label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  const setValue = <K extends keyof InvitationFormValues>(
    key: K,
    value: InvitationFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const toggleWeekday = (day: number) => {
    const selected = values.weekdays.includes(day);
    setValue('weekdays', selected ? values.weekdays.filter((d) => d !== day) : [...values.weekdays, day]);
  };

  const submit = () => {
    const result = validateInvitationForm(values);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    mutate(result.payload, {
      onSuccess: (created) => {
        router.replace({
          pathname: '/(resident)/invitation/[id]',
          params: { id: created.id ?? '' },
        });
      },
    });
  };

  return (
    <ScrollView className="flex-1 bg-bg-base" contentContainerClassName="gap-4 p-4 pb-10">
      <Text className="text-xl font-semibold text-text-primary">Crear invitación</Text>

      {invitableLots.length > 1 ? (
        <View className="gap-2">
          <Text className="text-sm text-text-muted">Lote</Text>
          <View className="rounded-xl border border-border bg-bg-elevated">
            <Picker
              selectedValue={values.lotId}
              onValueChange={(lotId) => setValue('lotId', lotId)}
              dropdownIconColor="#a1a1aa"
            >
              {invitableLots.map((lot) =>
                lot.id ? <Picker.Item key={lot.id} label={lot.code ?? lot.id} value={lot.id} /> : null,
              )}
            </Picker>
          </View>
        </View>
      ) : null}

      <View className="flex-row gap-2">
        {(['SINGLE', 'EVENT', 'RECURRING'] as const).map((type) => (
          <Button
            key={type}
            label={type === 'SINGLE' ? 'Unica' : type === 'EVENT' ? 'Evento' : 'Recurrente'}
            selected={values.type === type}
            onPress={() => setValue('type', type)}
          />
        ))}
      </View>

      <Input
        label="Nombre del invitado"
        value={values.guestName}
        onChangeText={(guestName) => setValue('guestName', guestName)}
        editable={!isPending}
      />
      <Input
        label="Documento (opcional)"
        value={values.guestDocument}
        onChangeText={(guestDocument) => setValue('guestDocument', guestDocument)}
        keyboardType="number-pad"
        editable={!isPending}
      />
      <Input
        label="Acompanantes (0 a 20)"
        value={values.companions}
        onChangeText={(companions) => setValue('companions', companions)}
        keyboardType="number-pad"
        editable={!isPending}
      />

      <DateTimeField
        label="Valido desde"
        value={values.validFrom}
        onChange={(validFrom) => setValue('validFrom', validFrom)}
        showPicker={showFrom}
        setShowPicker={setShowFrom}
        mode="datetime"
      />
      <DateTimeField
        label="Valido hasta"
        value={values.validUntil}
        onChange={(validUntil) => setValue('validUntil', validUntil)}
        showPicker={showUntil}
        setShowPicker={setShowUntil}
        mode="datetime"
      />

      {values.type === 'EVENT' ? (
        <Input
          label="Cupo (2 a 200)"
          value={values.maxUses}
          onChangeText={(maxUses) => setValue('maxUses', maxUses)}
          keyboardType="number-pad"
          editable={!isPending}
        />
      ) : null}

      {values.type === 'RECURRING' ? (
        <View className="gap-2">
          <Text className="text-sm text-text-muted">Dias de la semana</Text>
          <View className="flex-row flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const selected = values.weekdays.includes(day.value);
              return (
                <Button
                  key={day.value}
                  label={day.label}
                  selected={selected}
                  onPress={() => toggleWeekday(day.value)}
                />
              );
            })}
          </View>
          <DateTimeField
            label="Desde las"
            value={values.dailyFrom}
            onChange={(dailyFrom) => setValue('dailyFrom', dailyFrom)}
            showPicker={showDailyFrom}
            setShowPicker={setShowDailyFrom}
            mode="time"
          />
          <DateTimeField
            label="Hasta las"
            value={values.dailyUntil}
            onChange={(dailyUntil) => setValue('dailyUntil', dailyUntil)}
            showPicker={showDailyUntil}
            setShowPicker={setShowDailyUntil}
            mode="time"
          />
        </View>
      ) : null}

      {formError ? <Text className="text-sm text-text-primary">{formError}</Text> : null}
      {error && !formError ? (
        <Text className="text-sm text-text-primary">{error.message}</Text>
      ) : null}

      <Button
        label={isPending ? 'Creando' : 'Crear invitación'}
        onPress={submit}
        disabled={isPending}
      />
    </ScrollView>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
  showPicker,
  setShowPicker,
  mode,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
  mode: 'date' | 'time' | 'datetime';
}) {
  const display = value
    ? value.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Elegir';

  if (Platform.OS === 'android') {
    return (
      <View className="gap-2">
        <Text className="text-sm text-text-muted">{label}</Text>
        <Button label={display} onPress={() => setShowPicker(true)} />
        {showPicker ? (
          <DateTimePicker
            value={value ?? new Date()}
            mode={mode}
            onChange={(event, selected) => {
              setShowPicker(false);
              if (event.type === 'set' && selected) onChange(selected);
            }}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-sm text-text-muted">{label}</Text>
      <DateTimePicker
        value={value ?? new Date()}
        mode={mode}
        onChange={(_, selected) => {
          if (selected) onChange(selected);
        }}
        textColor="#fafafa"
        accentColor="#fafafa"
      />
    </View>
  );
}
