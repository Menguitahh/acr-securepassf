import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { components } from '@securepass/contracts';

import { api, authRequest } from '@/common/api/client';
import { useSessionStore } from '@/modules/auth/session-store';

type Platform_ = components['schemas']['RegisterDeviceRequest']['platform'];

function currentPlatform(): Platform_ | null {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  // Web y otras plataformas no reciben push nativo.
  return null;
}

async function fetchExpoPushToken(): Promise<string | null> {
  // Expo Go (SDK 53+) no soporta push remoto; getExpoPushTokenAsync tira
  // error. Se cae al catch y se marca la deuda en logs. Cuando haya dev
  // build, el mismo path funciona sin cambios.
  // ponytail: sin dev build el token nunca se emite; alcanza para que el
  // flujo de registro este armado, no genera ruido en el server.
  const projectId =
    Constants.expoConfig?.extra?.['eas']?.projectId ??
    Constants.easConfig?.projectId;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    const request = await Notifications.requestPermissionsAsync();
    if (!request.granted) return null;
  }
  const result = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return result.data ?? null;
}

// Se corre una vez por sesion signedIn. Falla silenciosa: la ausencia del
// token no bloquea al usuario, solo lo deja sin push (que en Expo Go
// tampoco iba a llegar).
export function useRegisterDeviceOnSignIn(): void {
  const status = useSessionStore((state) => state.status);
  const userId = useSessionStore((state) => state.user?.id);
  const registeredForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'signedIn' || !userId) return;
    if (registeredForUserRef.current === userId) return;
    registeredForUserRef.current = userId;

    const platform = currentPlatform();
    if (!platform) return;

    void (async () => {
      try {
        const expoPushToken = await fetchExpoPushToken();
        if (!expoPushToken) return;
        await authRequest(() =>
          api.POST('/api/v1/devices', { body: { expoPushToken, platform } }),
        );
      } catch {
        // Sin dev build / sin permiso / red caida: no interrumpe la sesion.
        // El proximo signIn vuelve a intentar (ref se resetea con userId nuevo).
      }
    })();
  }, [status, userId]);
}
