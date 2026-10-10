import { View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { qrSize } from '@/common/lib/qr';

type Props = {
  value: string;
};

// #233: QR en fondo blanco con margen de 24 dp: la zona de silencio (al
// menos 4 modulos) que necesita el lector. El tamano sigue al ancho de la
// pantalla para que no se salga en telefonos chicos.
export function QrTile({ value }: Props) {
  const { width } = useWindowDimensions();
  return (
    <View className="items-center justify-center rounded-lg bg-[#fafafa] p-6">
      <QRCode value={value} size={qrSize(width)} ecl="M" />
    </View>
  );
}
