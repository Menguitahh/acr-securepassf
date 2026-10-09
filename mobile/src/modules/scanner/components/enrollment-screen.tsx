import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Input } from '@/common/components/input';
import { Spinner } from '@/common/components/spinner';
import { DniCamera } from '@/modules/scanner/components/dni-camera';
import { LotPicker } from '@/modules/scanner/components/lot-picker';
import { formatDni, parseArgentineDni } from '@/modules/scanner/lib';
import type { DniData, EnrollmentSubject, LotChoice } from '@/modules/scanner/types';

type EnrollmentScreenProps = {
  // Nombre desde la invitacion (server, #111). Null si el server no lo
  // emitio (offline o server viejo): se degrada a la UI anterior (solo
  // input del DNI) — cruce visual imposible sin el nombre esperado.
  invitationName: string | null;
  subjectKind: EnrollmentSubject['kind'];
  // Lotes en franja del trabajador (con red). Con mas de uno se elige.
  lots: LotChoice[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (documentNumber: string, lotId: string | null) => void;
  onCancel: () => void;
};

// Modos: scanning (PDF417) -> scanned (confirmacion con cruce visual)
// o manual (input). El pasaje entre modos es SIEMPRE por accion
// explicita del guardia — no hay fallback automatico por tiempo (ver
// discusion historica en el bloque de scanning + #28).
//
// scanned: aparece cuando el parser del PDF417 devolvio ok. Muestra las
// dos lineas (invitacion vs DNI parseado) para que el guardia haga el
// cruce visual antes de confirmar. Sin comparacion automatica: el
// backend tampoco compara nombres, y automatizar el match ensena al
// guardia a no leer (ver #111 para el porque).
type Mode =
  | { kind: 'scanning' }
  | { kind: 'scanned'; dni: DniData }
  | { kind: 'manual' };

export function EnrollmentScreen({
  invitationName,
  subjectKind,
  lots,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: EnrollmentScreenProps) {
  const [mode, setMode] = useState<Mode>({ kind: 'scanning' });
  const needsLot = lots.length > 1;
  const [lotId, setLotId] = useState<string | null>(null);
  const label = subjectKind === 'worker' ? 'Trabajador' : 'Invitación';
  const picker = needsLot ? (
    <LotPicker lots={lots} selected={lotId} disabled={isSubmitting} onSelect={setLotId} />
  ) : null;
  const lotReady = !needsLot || lotId !== null;
  const [document, setDocument] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  const handleDniScan = (raw: string) => {
    const parsed = parseArgentineDni(raw);
    if (!parsed) {
      setScanError(
        'No se pudo leer el DNI. Verificá el codigo o cargá el numero manualmente.',
      );
      setMode({ kind: 'manual' });
      return;
    }
    setScanError(null);
    setDocument(parsed.document);
    setMode({ kind: 'scanned', dni: parsed });
  };

  if (mode.kind === 'scanning') {
    return (
      <View className="flex-1 bg-bg-base">
        <DniCamera onScan={handleDniScan} />
        <View className="absolute inset-x-0 top-20 items-center gap-2 px-6">
          {invitationName ? (
            <Text className="rounded-md bg-bg-elevated/90 px-4 py-2 text-body text-text-primary">
              {label}: {invitationName}
            </Text>
          ) : null}
          <Text className="rounded-md bg-bg-elevated/90 px-4 py-2 text-body text-text-primary">
            Enfocá el codigo PDF417 del DNI
          </Text>
        </View>
        <View className="absolute inset-x-0 bottom-8 px-6">
          <Button
            label="Cargar DNI manualmente"
            variant="primary"
            onPress={() => setMode({ kind: 'manual' })}
          />
        </View>
      </View>
    );
  }

  if (mode.kind === 'scanned') {
    return (
      <View className="flex-1 justify-between gap-6 bg-bg-base p-6">
        <View className="gap-4">
          <Text className="text-2xl font-semibold text-text-primary">
            Confirmar ingreso
          </Text>
          {/* Cruce visual: mismo tamano y peso en las dos lineas para
              que el ojo compare como iguales. Etiquetas alineadas en la
              misma columna (min-w) para saltar vertical sin buscar. Sin
              highlight de coincidencia — el juicio lo hace el guardia. */}
          <View className="gap-2">
            <View className="flex-row gap-2">
              <Text className="min-w-[104px] text-body text-text-muted">
                {label}:
              </Text>
              <Text className="flex-1 text-body text-text-primary">
                {invitationName ?? '—'}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Text className="min-w-[104px] text-body text-text-muted">
                DNI:
              </Text>
              <Text className="flex-1 text-body text-text-primary">
                {mode.dni.lastName}, {mode.dni.firstName} (
                {formatDni(mode.dni.document)})
              </Text>
            </View>
          </View>
          {picker}
          {error ? (
            <Text className="text-body text-deny">{error}</Text>
          ) : null}
          {isSubmitting ? <Spinner /> : null}
        </View>
        <View className="gap-3">
          <Button
            label="Registrar ingreso"
            variant="primary"
            disabled={isSubmitting || !lotReady}
            onPress={() => onSubmit(mode.dni.document, lotId)}
          />
          <Button
            label="Editar DNI"
            onPress={() => setMode({ kind: 'manual' })}
            disabled={isSubmitting}
          />
          <Button
            label="Reintentar cámara"
            onPress={() => {
              setScanError(null);
              setMode({ kind: 'scanning' });
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

  const trimmed = document.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting && lotReady;

  return (
    <View className="flex-1 justify-between gap-6 bg-bg-base p-6">
      <View className="gap-4">
        <Text className="text-2xl font-semibold text-text-primary">
          Enrolar DNI
        </Text>
        {invitationName ? (
          <Text className="text-body text-text-muted">
            {label}: <Text className="text-text-primary">{invitationName}</Text>
          </Text>
        ) : (
          <Text className="text-body text-text-muted">
            Primera vez que ingresa este {subjectKind === 'worker' ? 'trabajador' : 'invitado'}.
            Cargá el numero de documento para completar el ingreso.
          </Text>
        )}
        <Input
          label="DNI"
          value={document}
          onChangeText={setDocument}
          placeholder="30123456"
          keyboardType="number-pad"
          autoFocus
          editable={!isSubmitting}
        />
        {picker}
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
          onPress={() => onSubmit(trimmed, lotId)}
        />
        <Button
          label="Reintentar cámara"
          onPress={() => {
            setScanError(null);
            setMode({ kind: 'scanning' });
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
