import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { components } from '@securepass/contracts';

import { api, authRequest } from '@/common/api/client';
import { loadNotifications } from '@/common/notifications';
import { useSessionStore } from '@/modules/auth/session-store';

type Platform_ = components['schemas']['RegisterDeviceRequest']['platform'];

function currentPlatform(): Platform_ | null {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  // Web y otras plataformas no reciben push nativo.
  return null;
}

async function fetchExpoPushToken(): Promise<string | null> {
  const N = await loadNotifications();
  if (!N) return null;
  const projectId =
    Constants.expoConfig?.extra?.['eas']?.projectId ??
    Constants.easConfig?.projectId;
  const permission = await N.getPermissionsAsync();
  if (!permission.granted) {
    const request = await N.requestPermissionsAsync();
    if (!request.granted) return null;
  }
  const result = await N.getExpoPushTokenAsync(
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
      } catch (err) {
        // Sin dev build / sin permiso / red caida: no interrumpe la sesion.
        // El proximo signIn vuelve a intentar (ref se resetea con userId nuevo).
        console.warn('[devices] registro de push omitido:', err);
      }
    })();
  }, [status, userId]);
}
