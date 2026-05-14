import type { Request } from '@playwright/test';

/**
 * Patterns mock for `exploreServices` “tabs - namespace” serial tests.
 *
 * Loki’s pattern ingester is in-memory and empty for the static snapshot; the app still
 * issues the Loki `resources/patterns` HTTP request with a LogQL `query` that includes `namespace="…"`.
 * Vary `data` by namespace so tab counts differ between gateway vs mimir.
 *
 * Shape: matches `LokiPattern[]` (see `getMockPatternsApiResponse.ts`).
 */
const STATIC_PATTERN_BASE_TIMESTAMP_S = 1777201200;

const buildSamples = (counts: number[]) =>
  counts.map((count, idx) => [STATIC_PATTERN_BASE_TIMESTAMP_S + idx * 60, count] as [number, number]);

type PatternEntry = {
  level: string;
  pattern: string;
  samples: [number, number][];
};

const patternsByNamespace: Record<string, PatternEntry[]> = {
  gateway: [
    {
      level: 'info',
      pattern: 'level=info ts=<_> caller=poller.go:133 msg="<_>"',
      samples: buildSamples([10, 12, 9, 11, 13]),
    },
    {
      level: 'warn',
      pattern: 'level=warn ts=<_> caller=instance.go:43 msg="<_>"',
      samples: buildSamples([3, 4, 5, 2, 3]),
    },
  ],
  mimir: [
    {
      level: 'info',
      pattern: 'level=info ts=<_> caller=registry.go:232 msg="<_>"',
      samples: buildSamples([7, 8, 6, 9, 7]),
    },
  ],
};

/** JSON body for `route.fulfill({ json })` from the patterns resource request URL. */
export function getMockPatternsByNamespace(request: Request) {
  const url = new URL(request.url());
  const expression = url.searchParams.get('query') ?? '';
  const namespaceMatch = expression.match(/namespace\s*=\s*"([^"]+)"/);
  const namespace = namespaceMatch?.[1] ?? '';
  return {
    status: 'success' as const,
    data: patternsByNamespace[namespace] ?? [],
  };
}
