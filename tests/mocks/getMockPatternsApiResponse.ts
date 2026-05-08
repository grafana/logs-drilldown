/**
 * Static mock for Loki's `/loki/api/v1/patterns` endpoint.
 *
 * Why this exists:
 *   The pattern ingester is in-memory and operates on wall-clock time. The
 *   static-data Loki snapshot we ship for e2e (`tests/static-loki/provisioning/loki/data.zip`)
 *   contains chunks with timestamps from `STATIC_FROM`/`STATIC_TO` (May 2025),
 *   but no in-memory pattern state is preserved across the restart that
 *   happens when Loki boots from the snapshot. Pattern persistence
 *   (`__aggregated_metric__` streams) requires real wall-clock time to flush,
 *   which we don't have during snapshot generation.
 *
 *   So tests that assert on the Patterns tab UI (sample-table, legend filter,
 *   text search, include/exclude, level filter) need a deterministic patterns
 *   payload they can rely on regardless of the underlying snapshot.
 *
 * Pattern selection:
 *   The patterns below are crafted to match the *exact* log line formats
 *   emitted by `noisyTempo` in `generator/generator.go` for
 *   `service_name="tempo-distributor"`. `<_>` placeholders only appear where
 *   the generator interpolates values (`%s`/`%d`), so the pattern sample
 *   query that runs when a user clicks a `<_>` token (which uses `|>`
 *   pattern-match against real log lines) returns rows from the static
 *   snapshot and renders "From a sample of N rows found".
 *
 *   Constants from the generator (e.g. trace size `52428800`, memcached port
 *   `11211`, the literal `key=collectors/compactor`) are kept verbatim.
 *
 * Shape: matches `LokiPattern[]` from `src/services/datasource.ts`.
 */
const STATIC_PATTERN_BASE_TIMESTAMP_S = 1748257200; // 2025-05-26T11:00:00Z

const buildSamples = (counts: number[]) =>
  counts.map((count, idx) => [STATIC_PATTERN_BASE_TIMESTAMP_S + idx * 60, count] as [number, number]);

export const getMockPatternsApiResponse = () => {
  return {
    status: 'success',
    data: [
      {
        level: 'info',
        pattern: 'level=info ts=<_> caller=poller.go:133 msg="blocklist poll complete" seconds=<_>',
        samples: buildSamples([42, 50, 47, 60, 55, 48, 62, 51, 58, 49]),
      },
      {
        level: 'info',
        pattern: 'level=info ts=<_> caller=flush.go:253 msg="completing block" userid=<_> blockID=<_>',
        samples: buildSamples([12, 14, 11, 13, 15, 10, 12, 16, 13, 11]),
      },
      {
        level: 'info',
        pattern: 'level=info ts=<_> caller=compactor.go:242 msg="flushed to block" bytes=<_>B objects=<_> values=<_>',
        samples: buildSamples([20, 22, 19, 21, 24, 18, 23, 20, 22, 21]),
      },
      {
        level: 'info',
        pattern: 'level=info ts=<_> caller=registry.go:232 tenant=<_> msg="collecting metrics" active_series=<_>',
        samples: buildSamples([30, 33, 28, 31, 35, 29, 34, 30, 32, 31]),
      },
      {
        level: 'warn',
        pattern:
          'level=warn ts=<_> caller=instance.go:43 msg="TRACE_TOO_LARGE: max size of trace (52428800) exceeded tenant <_>"',
        samples: buildSamples([8, 9, 7, 10, 8, 6, 9, 7, 8, 9]),
      },
      {
        level: 'debug',
        pattern:
          'level=debug ts=<_> caller=broadcast.go:48 msg="Invalidating forwarded broadcast" key=collectors/compactor version=<_> oldVersion=<_> content=[compactor-<_>] oldContent=[compactor-<_>]',
        samples: buildSamples([4, 3, 5, 2, 6, 4, 3, 5, 4, 6]),
      },
      {
        level: 'error',
        pattern:
          'level=error ts=<_> caller=memcached.go:153 msg="Failed to get keys from memcached" err="memcache: connect timeout to <_>:11211"',
        samples: buildSamples([2, 3, 1, 4, 2, 3, 2, 1, 3, 2]),
      },
    ],
  };
};
