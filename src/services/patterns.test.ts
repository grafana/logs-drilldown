import { buildPatternLogsQuery, mergeLokiSamples } from './patterns';
import {
  LOG_STREAM_SELECTOR_EXPR,
  PATTERNS_SAMPLE_SELECTOR_EXPR,
  VAR_LEVELS_EXPR,
  VAR_METADATA_EXPR,
  VAR_PATTERNS_EXPR,
} from './variables';

it('inserts the pattern before the existing log pipeline', () => {
  expect(buildPatternLogsQuery('{app="api"} |= "failed" | json', 'request <_> failed')).toBe(
    '{app="api"} |> "request <_> failed" |= "failed" | json'
  );
});

it.each([LOG_STREAM_SELECTOR_EXPR, PATTERNS_SAMPLE_SELECTOR_EXPR])(
  'preserves the original Scene query template while replacing its pattern slot',
  (query) => {
    const result = buildPatternLogsQuery(query, 'request <_> failed', VAR_PATTERNS_EXPR);
    expect(result).toContain('|> "request <_> failed"');
    expect(result).toContain(VAR_METADATA_EXPR);
    expect(result).not.toContain(VAR_PATTERNS_EXPR);
    expect(result.includes(VAR_LEVELS_EXPR)).toBe(query === LOG_STREAM_SELECTOR_EXPR);
  }
);

it('preserves a literal pattern-variable string in a concrete query', () => {
  expect(buildPatternLogsQuery('{app="api"} |= "${patterns}"', 'request <_>')).toBe(
    '{app="api"} |> "request <_>" |= "${patterns}"'
  );
});

it('rejects queries without a stream selector', () => {
  expect(() => buildPatternLogsQuery('invalid', 'request <_>')).toThrow('Expected a LogQL stream selector');
});

describe('mergeLokiSamples', () => {
  it('should merge dataframes', () => {
    expect(
      mergeLokiSamples(
        [
          [100, 10],
          [110, 20],
        ],
        [
          [90, 3],
          [100, 7],
          [110, 11],
          [120, 13],
        ]
      )
    ).toEqual([
      [90, 3],
      [100, 17],
      [110, 31],
      [120, 13],
    ]);
  });
});
