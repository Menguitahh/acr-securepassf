import Constants from 'expo-constants';

// Wrapper defensivo alrededor de expo-notifications (#66).
//
// El bug: en Expo Go, el import namespace `import * as N from 'expo-notifications'`
// dispara un side effect (DevicePushTokenAutoRegistration.fx.js →
// warnOfExpoGoPushUsage) que hace THROW al cargar el modulo, aunque nunca se
// invoque nada. Rompe _layout.tsx en boot y cascada a "missing default export"
// en todas las routes. En dev build / standalone el side effect no se dispara.
//
// La solucion tiene que ser dynamic import + guard: un import estatico se
// resuelve antes que cualquier chequeo de appOwnership. Solo el import
// dinamico permite decidir en runtime si cargar el modulo o no.
//
// Todos los consumidores del proyecto tienen que pasar por aca, no importar
// expo-notifications directo. Si aparece un import estatico nuevo en el
// arbol, el bug vuelve.

type NotificationsModule = typeof import('expo-notifications');

let cache: Promise<NotificationsModule | null> | null = null;

export function getNotifications(): Promise<NotificationsModule | null> {
  if (cache) return cache;
  if (Constants.appOwnership === 'expo') {
    cache = Promise.resolve(null);
  } else {
    cache = import('expo-notifications');
  }
  return cache;
}

// Escape hatch para tests: reinicia el cache entre casos que mockean
// Constants.appOwnership con distintos valores.
export function __resetForTests(): void {
  cache = null;
}
