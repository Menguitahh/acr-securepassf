import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock del modulo real para verificar que se cargue (o no) dinamicamente.
const notificationsSpy = vi.hoisted(() => ({ marker: 'real-module' }));
vi.mock('expo-notifications', () => notificationsSpy);

// appOwnership se cambia por test; el mock global de expo-constants queda
// para no romper el resto de la suite, pero aca se reescribe.
vi.mock('expo-constants', () => ({
  default: { appOwnership: 'standalone' },
}));

async function importFresh() {
  vi.resetModules();
  return await import('@/common/notifications/safe');
}

describe('getNotifications', () => {
  afterEach(() => {
    vi.doUnmock('expo-constants');
  });

  it('en dev build (standalone) devuelve el modulo real', async () => {
    vi.doMock('expo-constants', () => ({ default: { appOwnership: 'standalone' } }));
    const { getNotifications } = await importFresh();
    const result = await getNotifications();
    expect(result).toEqual(notificationsSpy);
  });

  it('en Expo Go (appOwnership expo) devuelve null y NO carga expo-notifications', async () => {
    vi.doMock('expo-constants', () => ({ default: { appOwnership: 'expo' } }));
    const { getNotifications } = await importFresh();
    const result = await getNotifications();
    expect(result).toBeNull();
  });

  it('cachea el resultado: llamadas sucesivas devuelven la misma promise', async () => {
    vi.doMock('expo-constants', () => ({ default: { appOwnership: 'standalone' } }));
    const { getNotifications } = await importFresh();
    const p1 = getNotifications();
    const p2 = getNotifications();
    expect(p1).toBe(p2);
  });

  it('__resetForTests limpia el cache entre llamadas', async () => {
    vi.doMock('expo-constants', () => ({ default: { appOwnership: 'standalone' } }));
    const { getNotifications, __resetForTests } = await importFresh();
    const p1 = getNotifications();
    __resetForTests();
    const p2 = getNotifications();
    expect(p1).not.toBe(p2);
  });
});
