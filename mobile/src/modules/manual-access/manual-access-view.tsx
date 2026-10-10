import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { Spinner } from '@/common/components/spinner';
import { LotAutocomplete } from '@/modules/manual-access/components/lot-autocomplete';
import { useManualAccess } from '@/modules/manual-access/hooks';
import { validateManualAccess } from '@/modules/manual-access/lib';
import type { ManualAccessFormValues } from '@/modules/manual-access/types';
import { GATE_ID } from '@/modules/scanner/data';

const COMPANION_OPTIONS = Array.from({ length: 11 }, (_, n) => n);

function empty(): ManualAccessFormValues {
  return { subjectName: '', subjectDocument: '', lotCode: '', lotId: null, companions: 0 };
}

export function ManualAccessView() {
  const router = useRouter();
  const [values, setValues] = useState<ManualAccessFormValues>(empty);
  const [formError, setFormError] = useState<string | null>(null);
  const mutate = useManualAccess();

  const set = <K extends keyof ManualAccessFormValues>(
    key: K,
    value: ManualAccessFormValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    const clientEventId = Crypto.randomUUID();
    const result = validateManualAccess(values, GATE_ID ?? null, clientEventId);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    mutate.mutate(result.payload, {
      onSuccess: (outcome) => {
        // "Registrar ingreso" -> "Ingreso registrado"; sin red queda en la cola.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          outcome.kind === 'queued' ? 'Ingreso registrado sin conexión' : 'Ingreso registrado',
          outcome.kind === 'queued'
            ? `${outcome.subjectName} · DNI ${outcome.subjectDocument}. Queda en la cola y se envía solo cuando vuelva la red.`
            : `${outcome.subjectName} · DNI ${outcome.subjectDocument}`,
          [{ text: 'Listo', onPress: () => router.back() }],
        );
      },
      onError: (err) => {
        setFormError(err instanceof Error ? err.message : 'Reintentá en unos segundos.');
      },
    });
  };

  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-8" keyboardShouldPersistTaps="handled">
      <Text className="text-body text-text-muted">
        Visitantes sin pase: proveedores o visitas imprevistas. Funciona sin
        red y se envía cuando vuelve la conexión.
      </Text>
      <Input
        label="Nombre y apellido"
        value={values.subjectName}
        onChangeText={(subjectName) => set('subjectName', subjectName)}
        placeholder="Ej.: Ana Pérez"
        editable={!mutate.isPending}
      />
      <Input
        label="DNI"
        value={values.subjectDocument}
        onChangeText={(subjectDocument) => set('subjectDocument', subjectDocument)}
        placeholder="Ej.: 30123456"
        keyboardType="number-pad"
        editable={!mutate.isPending}
      />
      <LotAutocomplete
        value={values.lotCode}
        selectedId={values.lotId}
        onChange={(code) => setValues((prev) => ({ ...prev, lotCode: code, lotId: null }))}
        onSelect={(lot) =>
          setValues((prev) => ({
            ...prev,
            lotCode: lot.code ?? prev.lotCode,
            lotId: lot.id ?? null,
          }))
        }
        editable={!mutate.isPending}
      />
      <View className="gap-2">
        <Text className="text-footnote font-medium text-text-muted">Acompañantes</Text>
        {/* CLAUDE.md: control nativo, no un stepper custom. */}
        <View className="rounded-xl border border-border bg-bg-elevated">
          <Picker
            selectedValue={values.companions}
            onValueChange={(value) => set('companions', Number(value))}
            enabled={!mutate.isPending}
            dropdownIconColor="#a1a1aa"
            accessibilityLabel="Cantidad de acompañantes"
          >
            {COMPANION_OPTIONS.map((n) => (
              <Picker.Item key={n} label={n === 0 ? 'Sin acompañantes' : String(n)} value={n} />
            ))}
          </Picker>
        </View>
      </View>
      {formError ? <Text className="text-body text-deny">{formError}</Text> : null}
      {mutate.isPending ? <Spinner /> : null}
      <Button
        label="Registrar ingreso"
        variant="primary"
        disabled={mutate.isPending}
        onPress={submit}
      />
    </ScrollView>
  );
}
