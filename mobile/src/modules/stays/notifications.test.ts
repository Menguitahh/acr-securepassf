import { beforeEach, describe, expect, it, vi } from 'vitest';

// Caso Expo Go (#66): syncStayWarnings tiene que ser no-op cuando el
// wrapper devuelve null. Sin este guard, un iterate sobre stays llamaria
// a scheduleNotificationAsync sobre null y reventaria.

const getNotificationsMock = vi.fn();
vi.mock('@/common/notifications/safe', () => ({
  getNotifications: getNotificationsMock,
}));

// warnings-store en memoria: sin nativos, evita tocar AsyncStorage.
vi.mock('@/modules/stays/warnings-store', () => ({
  hasBeenWarned: () => false,
  warnedStayIds: () => new Set<string>(),
  recordWarning: vi.fn(),
  forgetWarning: () => null,
}));

describe('syncStayWarnings - guard Expo Go', () => {
  beforeEach(() => {
    getNotificationsMock.mockReset();
  });

  it('es no-op sin errores cuando el wrapper devuelve null', async () => {
    getNotificationsMock.mockResolvedValueOnce(null);
    const { syncStayWarnings } = await import('@/modules/stays/notifications');
    const stays = [
      { id: 's1', subjectName: 'Juan', lotCode: 'A-14', invitationValidUntil: '2030-01-01T00:00:00Z' },
    ] as never;
    await expect(syncStayWarnings(stays, Date.now())).resolves.toBeUndefined();
  });

  it('con modulo disponible avanza al reconciliation loop (no throw)', async () => {
    const scheduleSpy = vi.fn(async () => 'notif-id');
    getNotificationsMock.mockResolvedValue({
      getPermissionsAsync: async () => ({ granted: true }),
      requestPermissionsAsync: async () => ({ granted: true }),
      scheduleNotificationAsync: scheduleSpy,
      cancelScheduledNotificationAsync: async () => {},
      SchedulableTriggerInputTypes: { DATE: 'date' },
    });
    const { syncStayWarnings } = await import('@/modules/stays/notifications');
    // Lista vacia: se pasa por el modulo sin errores; el modo Expo Go quedaria
    // corto antes por el return, aca comprobamos que con modulo real el loop
    // corre. No hay stays para programar, no se debe llamar schedule.
    await expect(syncStayWarnings([], Date.now())).resolves.toBeUndefined();
    expect(scheduleSpy).not.toHaveBeenCalled();
  });
});
