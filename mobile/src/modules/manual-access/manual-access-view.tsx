import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { Spinner } from '@/common/components/spinner';
import { LotAutocomplete } from '@/modules/manual-access/components/lot-autocomplete';
import { useManualAccess } from '@/modules/manual-access/hooks';
import { validateManualAccess } from '@/modules/manual-access/lib';
import type { ManualAccessFormValues } from '@/modules/manual-access/types';
import { GATE_ID } from '@/modules/scanner/data';

function empty(): ManualAccessFormValues {
  return { subjectName: '', subjectDocument: '', lotCode: '', lotId: null };
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
      onSuccess: (data) => {
        Alert.alert(
          'Ingreso registrado',
          `${data.subjectName ?? values.subjectName} · DNI ${data.subjectDocument ?? values.subjectDocument}`,
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
        Cargá el ingreso de un visitante que llegue sin pase (proveedores,
        visita imprevista). Queda registrado como MANUAL.
      </Text>
      <Input
        label="Nombre y apellido"
        value={values.subjectName}
        onChangeText={(subjectName) => set('subjectName', subjectName)}
        placeholder="Juan Perez"
        editable={!mutate.isPending}
      />
      <Input
        label="DNI"
        value={values.subjectDocument}
        onChangeText={(subjectDocument) => set('subjectDocument', subjectDocument)}
        placeholder="30123456"
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
