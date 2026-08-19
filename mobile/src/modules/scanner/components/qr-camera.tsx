import { CameraView, useCameraPermissions } from 'expo-camera';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/common/components/button';

type QrCameraProps = {
  onScan: (token: string) => void;
};

export function QrCamera({ onScan }: QrCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();

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
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={({ data }) => onScan(data)}
    />
  );
}
