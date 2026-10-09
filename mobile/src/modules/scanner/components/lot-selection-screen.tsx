import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Spinner } from '@/common/components/spinner';
import { LotPicker } from '@/modules/scanner/components/lot-picker';
import type { LotChoice, LotSelection } from '@/modules/scanner/types';

type LotSelectionScreenProps = {
  selection: LotSelection;
  isSubmitting: boolean;
  onChoose: (lot: LotChoice) => void;
  onCancel: () => void;
};

// WBS-119 / US-67: el trabajador tiene franja en mas de un lote. Un toque en
// el lote registra el ingreso; sin lista larga ni confirmacion extra.
export function LotSelectionScreen({ selection, isSubmitting, onChoose, onCancel }: LotSelectionScreenProps) {
  return (
    <View className="flex-1 justify-between gap-6 bg-bg-base p-6">
      <View className="gap-4">
        <Text className="text-2xl font-semibold text-text-primary">Elegir lote</Text>
        <Text className="text-body text-text-muted">
          {selection.workerName ? `${selection.workerName} trabaja` : 'Este trabajador trabaja'} en más de un
          lote a esta hora. Preguntale a cuál va.
        </Text>
        <LotPicker
          lots={selection.lots}
          selected={null}
          disabled={isSubmitting}
          onSelect={(lotId) => {
            const lot = selection.lots.find((option) => option.lotId === lotId);
            if (lot) onChoose(lot);
          }}
        />
        {isSubmitting ? <Spinner /> : null}
      </View>
      <Button label="Cancelar" onPress={onCancel} disabled={isSubmitting} />
    </View>
  );
}
