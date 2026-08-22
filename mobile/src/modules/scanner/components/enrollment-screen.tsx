import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { Spinner } from '@/common/components/spinner';

type EnrollmentScreenProps = {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (documentNumber: string) => void;
  onCancel: () => void;
};

// PDF417 llega en WBS-63: por ahora captura manual. La pantalla es
// intencionalmente sin nombre del invitado; la identidad se confirma
// recien despues del POST /access/enroll.
export function EnrollmentScreen({
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: EnrollmentScreenProps) {
  const [document, setDocument] = useState('');
  const trimmed = document.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  return (
    <View className="flex-1 justify-between gap-6 bg-bg-base p-6">
      <View className="gap-4">
        <Text className="text-2xl font-semibold text-text-primary">
          Enrolar DNI
        </Text>
        <Text className="text-body text-text-muted">
          Primera vez que ingresa este invitado. Cargá el numero de documento
          para completar el ingreso.
        </Text>
        <Input
          label="DNI"
          value={document}
          onChangeText={setDocument}
          placeholder="30123456"
          keyboardType="number-pad"
          autoFocus
          editable={!isSubmitting}
        />
        {error ? (
          <Text className="text-body text-deny">{error}</Text>
        ) : null}
        {isSubmitting ? <Spinner /> : null}
      </View>
      <View className="gap-3">
        <Button
          label="Registrar ingreso"
          variant="primary"
          disabled={!canSubmit}
          onPress={() => onSubmit(trimmed)}
        />
        <Button label="Cancelar" onPress={onCancel} disabled={isSubmitting} />
      </View>
    </View>
  );
}
