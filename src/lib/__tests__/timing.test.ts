import { timingProblem, toDateInput } from '../input';
import { useDraft } from '@/store/draft';

describe('unfinished dose time input', () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  afterEach(() => { useDraft.getState().reset(); jest.restoreAllMocks(); });
  it('blocks incomplete, impossible and future dates instead of using an earlier committed time', () => {
    expect(timingProblem({ time: '1' }, now, now)).toBe('Tarih ve saati tam yaz.');
    expect(timingProblem({ date: '31.02.2026' }, now, now)).toBe('Tarih ve saati tam yaz.');
    expect(timingProblem({ date: toDateInput(now), time: '13:00' }, now, now)).toBe('Gelecekteki bir zaman girilemez.');
    expect(timingProblem({ bg: '09:' }, now, now)).toBe('Ölçüm saatini tam yaz.');
    expect(timingProblem({ date: toDateInput(now), time: '11:00', bg: '10:45' }, now, now)).toBeUndefined();
  });
  it('clears unfinished fields on reset and expiration', () => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    useDraft.getState().set({ timeInput: { time: '1' } });
    expect(useDraft.getState().timeInput).toEqual({ time: '1' });
    useDraft.getState().reset();
    expect(useDraft.getState().timeInput).toBeUndefined();
    useDraft.getState().set({ timeInput: { bg: '10:' } });
    jest.spyOn(Date, 'now').mockReturnValue(now + 16 * 60000);
    useDraft.getState().expire(15 * 60000);
    expect(useDraft.getState().timeInput).toBeUndefined();
  });
});
