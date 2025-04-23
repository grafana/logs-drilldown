import { LogsDedupStrategy } from '@grafana/data';
import { isDedupStrategy } from './guards';

describe('isDedupStrategy', () => {
  test('Identifies dedup strategies', () => {
    expect(isDedupStrategy(LogsDedupStrategy.exact)).toBe(true);
    expect(isDedupStrategy(LogsDedupStrategy.none)).toBe(true);
    expect(isDedupStrategy(LogsDedupStrategy.numbers)).toBe(true);
    expect(isDedupStrategy(LogsDedupStrategy.signature)).toBe(true);
  });

  test('Identifies non-dedup-strategies', () => {
    expect(isDedupStrategy('some')).toBe(false);
    expect(isDedupStrategy('odd')).toBe(false);
    expect(isDedupStrategy('')).toBe(false);
  });
});
