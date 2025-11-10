import { parsePrometheusDuration } from './parsePrometheusDuration';

describe('parsePrometheusDuration', () => {
  const tests: Array<[string, number]> = [
    ['1ms', 1],
    ['1s', 1000],
    ['1m', 1000 * 60],
    ['1h', 1000 * 60 * 60],
    ['1d', 1000 * 60 * 60 * 24],
    ['1w', 1000 * 60 * 60 * 24 * 7],
    ['1y', 1000 * 60 * 60 * 24 * 365],
    ['1d10h17m36s789ms', 123456789],
    ['1w4d10h20m54s321ms', 987654321],
    ['1y1w1d1h1m1s1ms', 32230861001],
  ];
  test.each(tests)('.parsePrometheusDuration(%s)', (input, expected) => {
    expect(parsePrometheusDuration(input)).toBe(expected);
  });
});
