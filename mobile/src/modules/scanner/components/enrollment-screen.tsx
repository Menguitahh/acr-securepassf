import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { Spinner } from '@/common/components/spinner';
import { DniCamera } from '@/modules/scanner/components/dni-camera';
import { parseArgentineDni } from '@/modules/scanner/lib';

type EnrollmentScreenProps = {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (documentNumber: string) => void;
  onCancel: () => void;
};

// Modos: scanning (PDF417) ↔ manual (input). El pasaje entre modos es
// SIEMPRE por accion explicita del guardia (boton "Cargar DNI
// manualmente" en camara, "Reintentar camara" en manual).
//
// NO hay fallback automatico por tiempo — se probo con timeout de 5s y
// en garita real no alcanza: el guardia todavia esta sacando el DNI de
// la billetera y dandolo vuelta cuando el timer dispara, perdiendo la
// camara justo cuando estaba por lograrlo. La camara queda activa hasta
// que el guardia decida pasar a manual. Ver #28 para el AC actualizado
// — no reintroducir un setTimeout aca.
export function EnrollmentScreen({
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: EnrollmentScreenProps) {
  const [mode, setMode] = useState<'scanning' | 'manual'>('scanning');
  const [document, setDocument] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  const handleDniScan = (raw: string) => {
    const parsed = parseArgentineDni(raw);
    if (!parsed) {
      setScanError(
        'No se pudo leer el DNI. Verificá el codigo o cargá el numero manualmente.',
      );
      setMode('manual');
      return;
    }
    setScanError(null);
    setDocument(parsed.document);
    setMode('manual');
  };

  if (mode === 'scanning') {
    return (
      <View className="flex-1 bg-bg-base">
        <DniCamera onScan={handleDniScan} />
        <View className="absolute inset-x-0 top-12 items-center px-6">
          <Text className="rounded-md bg-bg-elevated/90 px-4 py-2 text-body text-text-primary">
            Enfocá el codigo PDF417 del DNI
          </Text>
        </View>
        <View className="absolute inset-x-0 bottom-8 px-6">
          <Button
            label="Cargar DNI manualmente"
            variant="primary"
            onPress={() => setMode('manual')}
          />
        </View>
      </View>
    );
  }

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
        {scanError ? (
          <Text className="text-body text-warn">{scanError}</Text>
        ) : null}
        {error ? (
          <Text className="text-body text-deny">{error}</Text>
        ) : null}
        {isSubmitting ? <Spinner /> : null}
      </View>
      {/* Dos salidas distintas: "Reintentar camara" queda con la accion
          primaria (sigue enrolando, solo cambia el metodo de captura);
          "Cancelar" sale del enrolamiento entero y se separa con margen
          extra para que no se confunda con las de arriba. */}
      <View className="gap-3">
        <Button
          label="Registrar ingreso"
          variant="primary"
          disabled={!canSubmit}
          onPress={() => onSubmit(trimmed)}
        />
        <Button
          label="Reintentar cámara"
          onPress={() => {
            setScanError(null);
            setMode('scanning');
          }}
          disabled={isSubmitting}
        />
        <View className="mt-6">
          <Button label="Cancelar" onPress={onCancel} disabled={isSubmitting} />
        </View>
      </View>
    </View>
  );
}
