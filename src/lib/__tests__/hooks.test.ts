import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useNow } from '../hooks';

jest.mock('@/store/log', () => ({ useLog: {} }));
jest.mock('@/store/settings', () => ({ useSettings: {} }));
jest.mock('@/store/foods', () => ({ useFoods: {} }));
jest.mock('@/store/tests', () => ({ useTests: {} }));
jest.mock('@/lib/update', () => ({ useUpdateStore: {} }));

it('refreshes the analysis clock immediately after evidence history changes', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.useFakeTimers();
  const start = new Date(2026, 9, 15, 12).getTime();
  jest.setSystemTime(start);
  const observed: number[] = [];
  function Clock({ history }: { history: number[] }) {
    observed.push(useNow(60000, history));
    return null;
  }
  const original: number[] = [];
  let view: ReactTestRenderer | undefined;
  try {
    act(() => { view = create(createElement(Clock, { history: original })); });
    expect(observed[observed.length - 1]).toBe(start);
    jest.setSystemTime(start + 1000);
    act(() => { view?.update(createElement(Clock, { history: [start + 1000] })); });
    expect(observed[observed.length - 1]).toBe(start + 1000);
    act(() => { jest.advanceTimersByTime(60000); });
    expect(observed[observed.length - 1]).toBe(start + 61000);
  } finally {
    act(() => { view?.unmount(); });
    jest.useRealTimers();
  }
});
