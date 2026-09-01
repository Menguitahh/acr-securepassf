import { vi } from 'vitest';

// Mocks nativos que _layout.tsx (y su arbol de imports) toca al cargar.
// Superficie MINIMA — solo lo que hace falta para que el import no
// explote en Node. No refleja el comportamiento real de los modulos;
// no usar este setup para tests que ejerciten logica.
//
// IMPORTANTE #66: este setup NO reproduce el bug de expo-notifications
// en Expo Go. Ese bug es condicional a Hermes + Expo Go + import; en
// Node el side effect problematico (warnOfExpoGoPushUsage -> THROW) no
// se dispara porque no hay Constants.appOwnership === 'expo'. El smoke
// test cubre "default: undefined" de manera generica, no #66.
//
// Al agregar un native module nuevo al arbol de _layout, sumarlo aca
// con la superficie MINIMA que usa (import namespace o default). El
// error "Cannot find module X" del test es la senal.
//
// Platform.OS = 'android' porque es la plataforma de produccion. Si
// _layout algun dia branchea por plataforma y hace falta cubrir ambas,
// parametrizar el test con it.each(['android', 'ios']) y re-mockear
// dentro de cada iteracion.

vi.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  Platform: { OS: 'android' },
}));

vi.mock('expo-router', () => ({
  Stack: () => null,
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: () => {},
  getPermissionsAsync: async () => ({ granted: false }),
  addPushTokenListener: () => ({ remove: () => {} }),
  getExpoPushTokenAsync: async () => ({ data: '' }),
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: null, easConfig: null },
}));

vi.mock('expo-secure-store', () => ({
  setItemAsync: async () => {},
  getItemAsync: async () => null,
  deleteItemAsync: async () => {},
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));
