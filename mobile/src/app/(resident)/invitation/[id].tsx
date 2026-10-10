import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';

import { Button } from '@/common/components/button';
import { ErrorState } from '@/common/components/error-state';
import { ScreenHeader } from '@/common/components/screen-header';
import { Spinner } from '@/common/components/spinner';
import { useInvitation } from '@/modules/invitation/hooks';
import { passValidity } from '@/modules/invitation/lib';

// #233: la tarjeta es la misma imagen que se comparte. Solo el QR con su
// zona de silencio (32 de margen sobre 256, mas de 4 modulos) y una leyenda
// sin datos personales: nombre, lote y barrio los ve el guardia al escanear.
const CARD_WIDTH = 320;
const CARD_HEIGHT = 392;
const QR_SIZE = 256;
const QR_MARGIN = (CARD_WIDTH - QR_SIZE) / 2;
const SCREEN_PADDING = 24;

function toPngBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function InvitationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, error } = useInvitation(id);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const svgRef = useRef<Svg | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  // Hora de apertura: alcanza para el indicador de vigencia.
  const [openedAt] = useState(() => Date.now());

  if (isError) {
    return (
      <View className="flex-1 bg-bg-base">
        <ScreenHeader title="Pase" back />
        <ErrorState
          message={`${error instanceof Error ? error.message : 'No se pudo cargar el pase.'} Volvé e intentá de nuevo.`}
        />
      </View>
    );
  }
  if (isLoading) return <View className="flex-1 bg-bg-base"><Spinner /></View>;

  const isActive = data?.status === 'ACTIVE' && data.qrToken;
  const validity = passValidity(data?.validFrom, data?.validUntil, openedAt);
  // En pantallas chicas la tarjeta se achica entera (viewBox fijo).
  const cardWidth = Math.min(CARD_WIDTH, width - SCREEN_PADDING * 2);
  const cardHeight = (cardWidth / CARD_WIDTH) * CARD_HEIGHT;

  const share = () => {
    const svg = svgRef.current;
    if (!svg) return;
    setShareError(null);
    svg.toDataURL(async (dataUrl) => {
      try {
        const file = new File(Paths.cache, `pase-${id ?? 'invitacion'}.png`);
        file.write(toPngBytes(dataUrl));
        await Sharing.shareAsync(file.uri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir pase',
        });
      } catch {
        setShareError('No se pudo preparar el pase para compartir. Intentá de nuevo.');
      }
    });
  };

  return (
    <View className="flex-1 bg-bg-base">
      <ScreenHeader title={data?.guestName ?? 'Pase'} back />
      <ScrollView contentContainerClassName="flex-grow items-center justify-center gap-6 px-6 pb-8">
        {isActive && data.qrToken ? (
          <Animated.View
            entering={FadeInDown.duration(450).reduceMotion(ReduceMotion.System)}
            className="w-full items-center gap-6"
          >
            <Svg
              ref={svgRef}
              width={cardWidth}
              height={cardHeight}
              viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
              accessibilityLabel="Código QR del pase"
            >
              <Rect width={CARD_WIDTH} height={CARD_HEIGHT} rx={16} fill="#fafafa" />
              <G transform={`translate(${QR_MARGIN}, ${QR_MARGIN})`}>
                <QRCode value={data.qrToken} size={QR_SIZE} ecl="M" />
              </G>
              <SvgText x={CARD_WIDTH / 2} y={QR_MARGIN + QR_SIZE + 38} fill="#09090b" fontSize={16}
                fontWeight="bold" textAnchor="middle">
                Pase de acceso
              </SvgText>
              <SvgText x={CARD_WIDTH / 2} y={QR_MARGIN + QR_SIZE + 60} fill="#52525b" fontSize={13}
                textAnchor="middle">
                Solo válido en portería
              </SvgText>
              {validity ? (
                <SvgText x={CARD_WIDTH / 2} y={QR_MARGIN + QR_SIZE + 80} fill="#52525b" fontSize={13}
                  textAnchor="middle">
                  {validity.label}
                </SvgText>
              ) : null}
            </Svg>
            {shareError ? (
              <Text accessibilityRole="alert" className="text-center text-body leading-[22px] text-text-primary">
                {shareError}
              </Text>
            ) : null}
            <View className="w-full" style={{ maxWidth: cardWidth }}>
              <Button
                label="Compartir o guardar"
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  share();
                }}
                variant="primary"
              />
            </View>
            <Text className="text-center text-footnote leading-[18px] text-text-muted" style={{ maxWidth: cardWidth }}>
              La imagen no tiene datos del invitado. El guardia los ve al escanearla.
            </Text>
          </Animated.View>
        ) : (
          <>
            <Text className="text-center text-title font-semibold leading-[28px] text-text-primary">
              El pase no está activo.
            </Text>
            <Text className="max-w-[300px] text-center text-body leading-[22px] text-text-muted">
              Un pase {data?.status === 'EXPIRED' ? 'vencido' : 'usado o revocado'} no se puede
              escanear. Creá uno nuevo para el invitado.
            </Text>
            <Button
              label="Crear pase nuevo"
              onPress={() => router.replace('/(resident)/create')}
              variant="primary"
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
