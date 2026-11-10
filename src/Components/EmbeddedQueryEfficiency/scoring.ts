export type EfficiencyLevel = 'good' | 'warning' | 'poor';

export interface EfficiencyCheck {
  detail: string;
  id: string;
  status: EfficiencyLevel;
  title: string;
}

export interface EfficiencyScoreData {
  checks: EfficiencyCheck[];
  score: number;
}

// Placeholder standing in for the real Loki-stats-based scoring engine (indexed-label selectivity,
// line-filter-before-parser ordering, parser cost, label cardinality, bytes scanned vs. returned).
export function getPlaceholderEfficiencyData(): EfficiencyScoreData {
  return {
    checks: [
      {
        detail: 'Matches 8 of 1,240 streams using indexed labels.',
        id: 'stream-selectivity',
        status: 'good',
        title: 'Stream selector selectivity',
      },
      {
        detail: 'A line filter runs before any parser, so only matching lines get parsed.',
        id: 'line-filter-order',
        status: 'good',
        title: 'Line filters before parsing',
      },
      {
        detail: 'logfmt parses every matched line; a more selective filter first would cut this down.',
        id: 'parser-cost',
        status: 'warning',
        title: 'Parser cost',
      },
      {
        detail: 'No high-cardinality labels are used in aggregation.',
        id: 'label-cardinality',
        status: 'good',
        title: 'Label cardinality',
      },
      {
        detail: '42 MB scanned to return 1.2 MB of matching logs (34% of scanned bytes returned).',
        id: 'bytes-scanned',
        status: 'warning',
        title: 'Bytes scanned vs. returned',
      },
    ],
    score: 72,
  };
}
