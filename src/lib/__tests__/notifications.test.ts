import { Platform } from 'react-native';

const scheduled: { identifier: string; content: unknown; trigger: Record<string, unknown> }[] = [];

jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'storeClient' } }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    const i = scheduled.findIndex((s) => s.identifier === id);
    if (i >= 0) scheduled.splice(i, 1);
  }),
  scheduleNotificationAsync: jest.fn(async (req: { identifier: string; content: unknown; trigger: Record<string, unknown> }) => {
    scheduled.push(req);
    return req.identifier;
  }),
  getAllScheduledNotificationsAsync: jest.fn(async () => scheduled),
}));

// Bu ortamda react-native, react-native-web'e eşlenir (OS = 'web'); telefon davranışını denemek için Android'e çevir
(Platform as { OS: string }).OS = 'android';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scheduledBasal, syncBasalReminder } = require('../notifications') as typeof import('../notifications');

describe('bazal hatırlatıcısı', () => {
  beforeEach(() => (scheduled.length = 0));

  it('ayardaki saatte, her gün tekrarlanan tek bir bildirim kurar', async () => {
    expect(await syncBasalReminder(true, '22:00', 'Tojeo')).toBe(true);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].trigger).toMatchObject({ type: 'daily', hour: 22, minute: 0 });
    expect(await scheduledBasal()).toEqual({ hour: 22, minute: 0 });
  });
  it('saat 14:30 girildiyse tam 14:30 kurulur (öğleden sonra bildirimin sebebi ayardaki saat olur)', async () => {
    await syncBasalReminder(true, '14:30', '');
    expect(await scheduledBasal()).toEqual({ hour: 14, minute: 30 });
  });
  it('saat değişince eski bildirim silinir, çift kurulmaz', async () => {
    await syncBasalReminder(true, '14:30', 'Tojeo');
    await syncBasalReminder(true, '22:00', 'Tojeo');
    expect(scheduled).toHaveLength(1);
    expect(await scheduledBasal()).toEqual({ hour: 22, minute: 0 });
  });
  it('kapatınca kaldırılır; geçersiz saat kurmaz', async () => {
    await syncBasalReminder(true, '22:00', '');
    expect(await syncBasalReminder(false, '22:00', '')).toBe(true);
    expect(scheduled).toHaveLength(0);
    expect(await syncBasalReminder(true, '25:00', '')).toBe(false);
    expect(scheduled).toHaveLength(0);
  });
});
