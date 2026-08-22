import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/common/components/button';

type DniCameraProps = {
  onScan: (raw: string) => void;
};

// Camera dedicada a PDF417 del DNI. Se re-usa el patron de qr-camera:
// permiso, mensaje si esta denegado, absoluteFill. onScan se dispara una
// sola vez por montaje para que el consumidor decida que hacer (mostrar
// resultado, cerrar, etc.) sin re-triggers ruidosos.
export function DniCamera({ onScan }: DniCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const firedRef = useRef(false);

  if (!permission) return <View className="flex-1 bg-bg-base" />;
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg-base p-6">
        <Text className="text-center text-base text-text-primary">
          La camara esta deshabilitada. Habilitá el permiso para escanear DNI.
        </Text>
        <Button
          label="Habilitar camara"
          onPress={() => void requestPermission()}
        />
      </View>
    );
  }

  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['pdf417'] }}
      onBarcodeScanned={({ data }) => {
        if (firedRef.current) return;
        firedRef.current = true;
        onScan(data);
      }}
    />
  );
}
