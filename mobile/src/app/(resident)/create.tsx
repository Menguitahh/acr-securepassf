import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { DateField } from '@/common/components/date-field';
import { Input } from '@/common/components/input';
import { ScreenHeader } from '@/common/components/screen-header';
import { useSessionStore } from '@/modules/auth/session-store';
import { useCreateInvitation } from '@/modules/invitation/hooks';
import {
  MAX_INVITATION_WINDOW_DAYS,
  validateInvitationForm,
  type InvitationFormValues,
} from '@/modules/invitation/lib';

const INVITATION_TYPES = [
  { value: 'SINGLE', label: 'Unica' },
  { value: 'EVENT', label: 'Evento' },
] as const;

function defaultWindow(): { from: Date; until: Date } {
  const from = new Date();
  from.setHours(from.getHours() + 1, 0, 0, 0);
  const until = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, until };
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-footnote font-medium uppercase tracking-[1px] text-text-muted">
      {children}
    </Text>
  );
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
  }));
  const [formError, setFormError] = useState<string | null>(null);

  const { mutate, isPending, error } = useCreateInvitation();

  if (invitableLots.length === 0) {
    return (
      <View className="flex-1 bg-bg-base">
        <ScreenHeader title="Crear invitación" back />
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center text-title font-semibold leading-[28px] text-text-primary">
            No tenés lotes habilitados.
          </Text>
          <Text className="max-w-[300px] text-center text-body leading-[22px] text-text-muted">
            Pedí al titular de tu unidad familiar que te habilite para invitar.
          </Text>
        </View>
      </View>
    );
  }

  const setValue = <K extends keyof InvitationFormValues>(
    key: K,
    value: InvitationFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const result = validateInvitationForm(values);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    mutate(result.payload, {
      onSuccess: (created) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({
          pathname: '/(resident)/invitation/[id]',
          params: { id: created.id ?? '' },
        });
      },
    });
  };

  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Crear invitación" back />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-6 pb-12"
      >
        {invitableLots.length > 1 ? (
          <View className="gap-3">
            <SectionLabel>Lote</SectionLabel>
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

        <View className="gap-3">
          <SectionLabel>Invitado</SectionLabel>
          <Input
            label="Nombre del invitado"
            value={values.guestName}
            onChangeText={(guestName) => setValue('guestName', guestName)}
            editable={!isPending}
          />
          <Input
            label="DNI"
            value={values.guestDocument}
            onChangeText={(guestDocument) => setValue('guestDocument', guestDocument)}
            keyboardType="number-pad"
            editable={!isPending}
          />
          <Text className="text-footnote text-text-muted">
            El invitado va a tener que mostrar el DNI en garita la primera
            vez que entra: el guardia lo verifica contra este numero.
          </Text>
          <Input
            label="Acompanantes (0 a 20)"
            value={values.companions}
            onChangeText={(companions) => setValue('companions', companions)}
            keyboardType="number-pad"
            editable={!isPending}
          />
        </View>

        <View className="gap-3">
          <SectionLabel>Tipo de pase</SectionLabel>
          <View className="flex-row gap-2">
            {INVITATION_TYPES.map((type) => (
              <View key={type.value} className="flex-1">
                <Button
                  label={type.label}
                  selected={values.type === type.value}
                  onPress={() => setValue('type', type.value)}
                />
              </View>
            ))}
          </View>
        </View>

        <View className="gap-3">
          <SectionLabel>Vigencia</SectionLabel>
          <DateField
            label="Valido desde"
            value={values.validFrom}
            onChange={(validFrom) => setValue('validFrom', validFrom)}
            mode="datetime"
            minimumDate={new Date()}
            disabled={isPending}
          />
          <DateField
            label="Valido hasta"
            value={values.validUntil}
            onChange={(validUntil) => setValue('validUntil', validUntil)}
            mode="datetime"
            minimumDate={values.validFrom ?? new Date()}
            maximumDate={new Date((values.validFrom ?? new Date()).getTime() + MAX_INVITATION_WINDOW_DAYS * 24 * 60 * 60 * 1000)}
            disabled={isPending}
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
        </View>

        {formError ? (
          <Text className="text-body leading-[22px] text-text-primary">{formError}</Text>
        ) : null}
        {error && !formError ? (
          <Text className="text-body leading-[22px] text-text-primary">{error.message}</Text>
        ) : null}

        <Button
          label={isPending ? 'Creando' : 'Crear invitación'}
          onPress={submit}
          disabled={isPending}
          variant="primary"
        />
      </ScrollView>
    </View>
  );
}

