import Constants from 'expo-constants';

// Expo Go (SDK 53+) no soporta push remoto y el propio import de
// expo-notifications puede tumbar el modulo raiz. Se carga dinamicamente
// y solo cuando corremos fuera de Expo Go.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

export type NotificationsModule = typeof import('expo-notifications');

let cached: Promise<NotificationsModule | null> | null = null;

export function loadNotifications(): Promise<NotificationsModule | null> {
  if (IS_EXPO_GO) return Promise.resolve(null);
  if (!cached) {
    cached = import('expo-notifications').catch((err) => {
      console.warn('[notifications] carga dinamica fallida:', err);
      return null;
    });
  }
  return cached;
}
