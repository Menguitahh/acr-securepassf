import { Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import type { LotChoice } from '@/modules/scanner/types';

type LotPickerProps = {
  lots: LotChoice[];
  selected: string | null;
  disabled: boolean;
  onSelect: (lotId: string) => void;
};

// El trabajador tiene franja en mas de un lote: el guardia pregunta a cual
// va. El enroll lleva ese lotId (securepassb#223). Con uno solo no se muestra.
export function LotPicker({ lots, selected, disabled, onSelect }: LotPickerProps) {
  return (
    <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Lote al que va">
      <Text className="text-body text-text-muted">¿A qué lote va?</Text>
      <View className="flex-row flex-wrap gap-2">
        {lots.map((lot) => (
          <View key={lot.lotId} className="min-w-[96px]">
            <Button
              label={lot.code}
              variant={selected === lot.lotId ? 'primary' : 'secondary'}
              disabled={disabled}
              onPress={() => onSelect(lot.lotId)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
