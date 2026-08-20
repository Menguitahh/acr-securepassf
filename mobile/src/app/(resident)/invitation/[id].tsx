import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { Button } from '@/common/components/button';
import { ErrorState } from '@/common/components/error-state';
import { ScreenHeader } from '@/common/components/screen-header';
import { Spinner } from '@/common/components/spinner';
import { useSessionStore } from '@/modules/auth/session-store';
import { useInvitation } from '@/modules/invitation/hooks';
import { formatWindow, shareLines } from '@/modules/invitation/lib';

const CARD_WIDTH = 340;
const CARD_HEIGHT = 440;
const QR_SIZE = 280;

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
  const lots = useSessionStore((state) => state.user?.lots) ?? [];
  const lotCode = lots.find((lot) => lot.id === data?.lotId)?.code ?? null;
  const svgRef = useRef<Svg | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

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

  const lines = shareLines(data ?? {}, lotCode, data?.neighborhoodName ?? null);
  const isActive = data?.status === 'ACTIVE' && data.qrToken;

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
      <View className="flex-1 items-center justify-center gap-6 px-6">
        {isActive && data.qrToken ? (
          <>
            <Animated.View
              entering={FadeInDown.duration(450).reduceMotion(ReduceMotion.System)}
              className="items-center gap-6"
            >
            <Svg
              ref={svgRef}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
            >
              <Rect width={CARD_WIDTH} height={CARD_HEIGHT} rx={16} fill="#fafafa" />
              <Svg x={(CARD_WIDTH - QR_SIZE) / 2} y={30}>
                <QRCode value={data.qrToken} size={QR_SIZE} />
              </Svg>
              {lines.map((line, index) => (
                <SvgText
                  key={line}
                  x={24}
                  y={340 + index * 24}
                  fill="#09090b"
                  fontSize={15}
                  fontWeight={index === 0 ? 'bold' : 'normal'}
                >
                  {line}
                </SvgText>
              ))}
            </Svg>
            <Text className="text-center text-footnote leading-[18px] text-text-muted">
              {formatWindow(data?.validFrom, data?.validUntil)}
            </Text>
            {shareError ? (
              <Text className="text-center text-body leading-[22px] text-text-primary">
                {shareError}
              </Text>
            ) : null}
            <View className="w-full max-w-[340px]">
              <Button
                label="Compartir pase"
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  share();
                }}
                variant="primary"
              />
            </View>
            </Animated.View>
          </>
        ) : (
          <>
            <Text className="text-center text-title font-semibold leading-[28px] text-text-primary">
              El pase no esta activo.
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
      </View>
    </View>
  );
}
