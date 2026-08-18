import { getDisplayedLogsCount } from './logsCount';

describe('getDisplayedLogsCount', () => {
  it('prefers the exact logs count when under the line limit, even if a total exists', () => {
    expect(getDisplayedLogsCount(72, 75, 1000)).toBe(75);
  });

  it('falls back to the total count when the line limit was hit', () => {
    expect(getDisplayedLogsCount(150000, 1000, 1000)).toBe(150000);
  });

  it('falls back to the total count when the logs count exceeds the limit (infinite scroll)', () => {
    expect(getDisplayedLogsCount(150000, 2000, 1000)).toBe(150000);
  });

  it('shows the exact logs count when no total is available yet', () => {
    expect(getDisplayedLogsCount(undefined, 75, 1000)).toBe(75);
  });

  it('returns undefined when the limit was hit and no total is available', () => {
    expect(getDisplayedLogsCount(undefined, 1000, 1000)).toBeUndefined();
  });

  it('returns undefined when neither count is available', () => {
    expect(getDisplayedLogsCount(undefined, undefined, 1000)).toBeUndefined();
  });

  it('shows an exact zero instead of a stale total', () => {
    expect(getDisplayedLogsCount(72, 0, 1000)).toBe(0);
  });
});
