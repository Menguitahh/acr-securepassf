import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { Button } from '@/common/components/button';
import { ErrorState } from '@/common/components/error-state';
import { Spinner } from '@/common/components/spinner';
import { useSessionStore } from '@/modules/auth/session-store';
import { useInvitation } from '@/modules/invitation/hooks';
import { shareLines } from '@/modules/invitation/lib';

const CARD_WIDTH = 300;
const CARD_HEIGHT = 400;

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
        <ErrorState
          message={`${error instanceof Error ? error.message : 'No se pudo cargar el pase.'} Volvé e intentá de nuevo.`}
        />
        <View className="p-6">
          <Button label="Volver" onPress={() => router.back()} />
        </View>
      </View>
    );
  }
  if (isLoading) return <View className="flex-1 bg-bg-base"><Spinner /></View>;

  const lines = shareLines(data ?? {}, lotCode, data?.neighborhoodName ?? null);

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
    <View className="flex-1 items-center justify-center gap-6 bg-bg-base p-6">
      {data?.status === 'ACTIVE' && data.qrToken ? (
        <Svg
          ref={svgRef}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
        >
          <Rect width={CARD_WIDTH} height={CARD_HEIGHT} rx={12} fill="#fafafa" />
          <Svg x={30} y={30}>
            <QRCode value={data.qrToken} size={240} />
          </Svg>
          {lines.map((line, index) => (
            <SvgText
              key={line}
              x={20}
              y={300 + index * 22}
              fill="#09090b"
              fontSize={14}
              fontWeight={index === 0 ? 'bold' : 'normal'}
            >
              {line}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <Text className="text-center text-base text-text-primary">
          El pase no esta activo y no se puede escanear.
        </Text>
      )}
      {shareError ? (
        <Text className="text-sm text-text-primary">{shareError}</Text>
      ) : null}
      {data?.status === 'ACTIVE' && data.qrToken ? (
        <Button label="Compartir pase" onPress={share} />
      ) : null}
      <Button label="Volver" onPress={() => router.back()} />
    </View>
  );
}
