import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';

import { EmptyState } from '@/common/components/empty-state';
import { ErrorState } from '@/common/components/error-state';
import { ScreenHeader } from '@/common/components/screen-header';
import { Spinner } from '@/common/components/spinner';
import { useMyPasses } from '@/modules/invitation/hooks';

const QR_SIZE = 280;

export default function PersonalQrScreen() {
  const { data, isLoading, isError } = useMyPasses();
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (isError) {
    return (
      <View className="flex-1 bg-bg-base">
        <ScreenHeader title="Mi QR" back />
        <ErrorState message="No se pudo cargar tu pase personal. Volvé e intentá de nuevo." />
      </View>
    );
  }
  if (isLoading) return <View className="flex-1 bg-bg-base"><Spinner /></View>;

  const passes = data ?? [];
  if (passes.length === 0) {
    return (
      <View className="flex-1 bg-bg-base">
        <ScreenHeader title="Mi QR" back />
        <EmptyState
          title="Todavia no tenés pase personal."
          description="Cuando la administración te asigne uno, va a aparecer aca para entrar al barrio."
        />
      </View>
    );
  }

  const pass = passes[Math.min(selectedIndex, passes.length - 1)];

  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title="Mi QR" back />
      <View className="flex-1 items-center justify-center gap-6 px-6">
        {passes.length > 1 ? (
          <View className="w-full max-w-[340px] rounded-xl border border-border bg-bg-elevated">
            <Picker
              selectedValue={selectedIndex}
              onValueChange={(index) => setSelectedIndex(Number(index))}
              dropdownIconColor="#a1a1aa"
            >
              {passes.map((item, index) => (
                <Picker.Item
                  key={item.lotId ?? index}
                  label={`Lote ${item.lotCode ?? ''} - ${item.neighborhoodName ?? ''}`}
                  value={index}
                />
              ))}
            </Picker>
          </View>
        ) : null}

        <Animated.View
          entering={FadeInDown.duration(450).reduceMotion(ReduceMotion.System)}
          className="items-center gap-6 rounded-2xl bg-[#fafafa] p-6"
        >
          {pass?.qrToken ? <QRCode value={pass.qrToken} size={QR_SIZE} /> : null}
          <View className="items-center gap-1">
            <Text className="text-body font-semibold leading-[22px] text-[#09090b]">
              {pass?.neighborhoodName ?? ''}
            </Text>
            {pass?.lotCode ? (
              <Text className="text-footnote leading-[18px] text-[#52525b]">
                Lote {pass.lotCode}
              </Text>
            ) : null}
          </View>
        </Animated.View>

        <Text className="text-center text-footnote leading-[18px] text-text-muted">
          Mostrá este QR en la garita para entrar al barrio.
        </Text>
      </View>
    </View>
  );
}
