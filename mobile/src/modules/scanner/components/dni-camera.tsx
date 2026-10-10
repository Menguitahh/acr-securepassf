import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { TorchButton } from '@/modules/scanner/components/torch-button';

type DniCameraProps = {
  onScan: (raw: string) => void;
};

// Camera dedicada a PDF417 del DNI. Se re-usa el patron de qr-camera:
// permiso, mensaje si esta denegado, absoluteFill. onScan se dispara una
// sola vez por montaje para que el consumidor decida que hacer (mostrar
// resultado, cerrar, etc.) sin re-triggers ruidosos.
export function DniCamera({ onScan }: DniCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const firedRef = useRef(false);

  if (!permission) return <View className="flex-1 bg-bg-base" />;
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg-base p-6">
        <Text className="text-center text-base text-text-primary">
          La camara esta deshabilitada. Habilitá el permiso para escanear DNI.
        </Text>
        <Button
          label="Habilitar cámara"
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
        barcodeScannerSettings={{ barcodeTypes: ['pdf417'] }}
        onBarcodeScanned={({ data }) => {
          if (firedRef.current) return;
          firedRef.current = true;
          onScan(data);
        }}
      />
      <TorchButton on={torch} onToggle={() => setTorch((v) => !v)} />
    </View>
  );
}

