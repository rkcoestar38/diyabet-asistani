import { Platform } from 'react-native';

const mockScheduled = new Map<string, unknown>();
jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'storeClient' } }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'interval' },
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => { mockScheduled.delete(id); }),
  scheduleNotificationAsync: jest.fn(async (request: { identifier: string }) => { mockScheduled.set(request.identifier, request); return request.identifier; }),
}));
Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { schedulePostMealReminder }: typeof import('../notifications') = require('../notifications');

describe('retroactive post-meal reminder', () => {
  it('preserves an upcoming reminder when an old meal no longer needs one', async () => {
    const now = Date.now();
    const id = await schedulePostMealReminder(120, 'Current synthetic meal', now);
    expect(id).toBeDefined();
    const original = mockScheduled.get(id ?? '');
    expect(await schedulePostMealReminder(120, 'Old synthetic meal', now - 5 * 3600000)).toBeUndefined();
    expect(mockScheduled.size).toBe(1);
    expect(mockScheduled.get(id ?? '')).toBe(original);
  });
});

