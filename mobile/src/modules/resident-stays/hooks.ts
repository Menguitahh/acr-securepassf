import type { NotificationResponse } from 'expo-notifications';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { getNotifications } from '@/common/notifications/safe';
import { useExtendInvitation, useRequestExit } from '@/modules/invitation/hooks';
import { EXTEND_ACTION, REQUEST_EXIT_ACTION, STAY_WARNING_CATEGORY } from '@/modules/resident-stays/data';
import { parseStayWarningAction } from '@/modules/resident-stays/lib';
import { formatEnteredAt as formatTime } from '@/modules/stays/lib';

// #33 (US-42): botones Extender / Que se retire en el push de permanencia.
// Tocar un boton abre la app (en Android, un boton sin abrir la app no corre
// JS con la app cerrada) y aca se llama al mismo endpoint que la card. El
// resultado se muestra con la misma palabra que el boton; el motivo del tope
// de extensiones llega en el mensaje del error. Solo en development build:
// en Expo Go getNotifications es null y esto no hace nada.
export function useStayWarningActions(enabled: boolean) {
  // mutate es estable en TanStack v5: el listener se registra una vez.
  const { mutate: extend } = useExtendInvitation();
  const { mutate: requestExit } = useRequestExit();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    void (async () => {
      const N = await getNotifications();
      if (!N || cancelled) return;
      await N.setNotificationCategoryAsync(STAY_WARNING_CATEGORY, [
        { identifier: EXTEND_ACTION, buttonTitle: 'Extender' },
        { identifier: REQUEST_EXIT_ACTION, buttonTitle: 'Que se retire' },
      ]);

      // import type: no carga el modulo (#66), solo el tipo.
      const handle = (response: NotificationResponse) => {
        const action = parseStayWarningAction(response.actionIdentifier, response.notification.request.content.data);
        if (!action) return;
        // Android deja la notificacion en la bandeja despues de tocar un boton.
        void N.dismissNotificationAsync(response.notification.request.identifier);
        if (action.kind === 'extend') {
          extend(action.invitationId, {
            onSuccess: (data) =>
              Alert.alert(
                'Pase extendido',
                data.validUntil ? `La visita puede quedarse hasta las ${formatTime(data.validUntil)}` : 'La visita puede quedarse más tiempo.',
              ),
            onError: (err) => Alert.alert('No se pudo extender', err.message),
          });
        } else {
          requestExit(action.invitationId, {
            onSuccess: () => Alert.alert('Aviso enviado', 'La garita ya sabe que la visita se tiene que retirar.'),
            onError: (err) => Alert.alert('No se pudo enviar', err.message),
          });
        }
      };

      subscription = N.addNotificationResponseReceivedListener(handle);
      // App cerrada: el boton la abre y la respuesta queda como la ultima.
      // Se limpia para que la proxima apertura no repita la accion.
      const last = await N.getLastNotificationResponseAsync();
      if (last && !cancelled) {
        await N.clearLastNotificationResponseAsync();
        handle(last);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, extend, requestExit]);
}
