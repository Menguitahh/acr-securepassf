import { beforeEach, describe, expect, it, vi } from 'vitest';

// Caso Expo Go (#66): si getNotifications() devuelve null, fetchExpoPushToken
// no puede llamar getPermissionsAsync ni getExpoPushTokenAsync — reventaria
// distinto pero reventaria igual. Este test blinda el guard.

const getNotificationsMock = vi.fn();
vi.mock('@/common/notifications/safe', () => ({
  getNotifications: getNotificationsMock,
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } }, easConfig: null },
}));

describe('fetchExpoPushToken - guard Expo Go', () => {
  beforeEach(() => {
    getNotificationsMock.mockReset();
  });

  it('devuelve null sin tocar expo-notifications cuando el wrapper devuelve null', async () => {
    getNotificationsMock.mockResolvedValueOnce(null);
    const { fetchExpoPushToken } = await import('@/modules/devices/hooks');
    const result = await fetchExpoPushToken();
    expect(result).toBeNull();
    expect(getNotificationsMock).toHaveBeenCalledTimes(1);
  });

  it('con modulo disponible pide permisos y devuelve el token', async () => {
    getNotificationsMock.mockResolvedValueOnce({
      getPermissionsAsync: async () => ({ granted: true }),
      requestPermissionsAsync: async () => ({ granted: true }),
      getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[xxx]' }),
    });
    const { fetchExpoPushToken } = await import('@/modules/devices/hooks');
    const result = await fetchExpoPushToken();
    expect(result).toBe('ExponentPushToken[xxx]');
  });

  it('sin permiso otorgado devuelve null', async () => {
    getNotificationsMock.mockResolvedValueOnce({
      getPermissionsAsync: async () => ({ granted: false }),
      requestPermissionsAsync: async () => ({ granted: false }),
      getExpoPushTokenAsync: async () => ({ data: 'noalcanza' }),
    });
    const { fetchExpoPushToken } = await import('@/modules/devices/hooks');
    const result = await fetchExpoPushToken();
    expect(result).toBeNull();
  });
});
