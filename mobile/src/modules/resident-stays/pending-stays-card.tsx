import { Alert, Text, View } from 'react-native';

import { Button } from '@/common/components/button';
import { Card } from '@/common/components/card';
import { Spinner } from '@/common/components/spinner';
import { useExtendInvitation, useRequestExit } from '@/modules/invitation/hooks';
import { exitAlreadyRequested, pendingResidentStays } from '@/modules/resident-stays/lib';
import { useOpenStays } from '@/modules/stays/hooks';
import type { Stay } from '@/modules/stays/types';

// Card en la home del residente que aparece solo cuando hay estadias
// warned pendientes de respuesta. Sirve como fallback in-app mientras
// no haya push remoto (Expo Go no lo soporta, ver spec seccion 15).
// El polling lo hace useOpenStays cada 60 s en primer plano.
export function PendingStaysCard() {
  const { data } = useOpenStays();
  const pending = pendingResidentStays(data ?? []);

  if (pending.length === 0) return null;

  return (
    <View className="gap-2">
      {pending.map((stay) => (
        <PendingStayRow key={stay.id ?? stay.invitationId ?? ''} stay={stay} />
      ))}
    </View>
  );
}

function PendingStayRow({ stay }: { stay: Stay }) {
  const extend = useExtendInvitation();
  const requestExit = useRequestExit();
  const invitationId = stay.invitationId;
  const alreadyAsked = exitAlreadyRequested(stay);

  const onExtend = () => {
    if (!invitationId) return;
    extend.mutate(invitationId, {
      onError: (err) =>
        Alert.alert(
          'No se pudo extender',
          err instanceof Error ? err.message : 'Reintentá en unos segundos.',
        ),
    });
  };

  const onRequestExit = () => {
    if (!invitationId) return;
    Alert.alert(
      'Pedir que se retire',
      `¿Avisar a la garita para que ${stay.subjectName ?? 'la visita'} se retire?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pedir',
          style: 'destructive',
          onPress: () => {
            requestExit.mutate(invitationId, {
              onError: (err) =>
                Alert.alert(
                  'No se pudo enviar',
                  err instanceof Error ? err.message : 'Reintentá en unos segundos.',
                ),
            });
          },
        },
      ],
      { cancelable: true },
    );
  };

  const busy = extend.isPending || requestExit.isPending;

  return (
    <Card>
      <Text className="text-footnote text-warn">Permanencia por vencer</Text>
      <Text className="mt-1 text-body font-semibold text-text-primary">
        {stay.subjectName ?? 'Invitado'}
      </Text>
      {typeof stay.minutesRemaining === 'number' ? (
        <Text className="mt-1 text-footnote text-text-muted">
          {stay.minutesRemaining <= 0
            ? 'Vencido'
            : `Faltan ${stay.minutesRemaining} min`}
        </Text>
      ) : null}
      {alreadyAsked ? (
        <Text className="mt-3 text-footnote text-text-muted">
          Ya avisaste a la garita.
        </Text>
      ) : null}
      {busy ? <Spinner /> : null}
      <View className="mt-4 flex-row gap-2">
        <View className="flex-1">
          <Button label="Extender" variant="primary" disabled={busy} onPress={onExtend} />
        </View>
        <View className="flex-1">
          <Button
            label={alreadyAsked ? 'Reiterar retiro' : 'Que se retire'}
            disabled={busy}
            onPress={onRequestExit}
          />
        </View>
      </View>
    </Card>
  );
}
