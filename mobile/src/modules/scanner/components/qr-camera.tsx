import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/common/components/button';

type QrCameraProps = {
  onScan: (token: string) => void;
};

export function QrCamera({ onScan }: QrCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);

  if (!permission) return <View className="flex-1 bg-bg-base" />;
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg-base p-6">
        <Text className="text-center text-base text-text-primary">
          La camara esta deshabilitada. Habilitá el permiso para escanear pases.
        </Text>
        <Button
          label="Habilitar camara"
          onPress={() => void requestPermission()}
        />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        enableTorch={torch}
        ratio="4:3"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      <TorchButton on={torch} onToggle={() => setTorch((v) => !v)} />
    </View>
  );
}

function TorchButton({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Apagar linterna' : 'Encender linterna'}
      accessibilityState={{ selected: on }}
      className={`absolute right-4 top-4 h-12 min-w-[96px] items-center justify-center rounded-md border px-4 ${
        on
          ? 'border-text-primary bg-text-primary'
          : 'border-text-primary bg-bg-elevated/70'
      }`}
    >
      <Text
        className={`text-body font-semibold ${
          on ? 'text-bg-base' : 'text-text-primary'
        }`}
      >
        Linterna
      </Text>
    </Pressable>
  );
}
