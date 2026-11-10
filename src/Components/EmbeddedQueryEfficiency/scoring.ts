import { IndexStatsResponse } from './statsApi';

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

// Comfortable below, failing above; log-scaled in between so the score falls off gradually
// rather than snapping between buckets. Sized for production observability volumes (a single
// query routinely touching GBs and thousands of streams), not a small local test setup.
const BYTES_GOOD_MAX = 1024 * 1024 * 1024; // 1 GiB
const BYTES_POOR_MIN = 1024 * 1024 * 1024 * 1024; // 1 TiB
const STREAMS_GOOD_MAX = 500;
const STREAMS_POOR_MIN = 50_000;

function scoreFromRange(value: number, goodMax: number, poorMin: number): number {
  if (value <= goodMax) {
    return 100;
  }
  if (value >= poorMin) {
    return 10;
  }
  const t = Math.log(value / goodMax) / Math.log(poorMin / goodMax);
  return Math.round(100 - t * 90);
}

function levelForScore(score: number): EfficiencyLevel {
  if (score >= 80) {
    return 'good';
  }
  if (score >= 50) {
    return 'warning';
  }
  return 'poor';
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 || value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

// Derives an efficiency score from Loki's index/stats response for the query's stream selector:
// how much data and how many streams it touches over the selected time range. The overall score
// is the weaker of the two dimensions, since either one alone can make a query expensive.
export function computeEfficiencyScore(stats: IndexStatsResponse): EfficiencyScoreData {
  const bytesScore = scoreFromRange(stats.bytes, BYTES_GOOD_MAX, BYTES_POOR_MIN);
  const streamsScore = scoreFromRange(stats.streams, STREAMS_GOOD_MAX, STREAMS_POOR_MIN);

  return {
    checks: [
      {
        detail: `The stream selector touches ${formatBytes(stats.bytes)} across ${stats.chunks.toLocaleString()} chunks and ${stats.entries.toLocaleString()} log lines over the selected time range.`,
        id: 'bytes-scanned',
        status: levelForScore(bytesScore),
        title: 'Data volume',
      },
      {
        detail: `Matches ${stats.streams.toLocaleString()} streams. Fewer, more selective indexed-label matches keep this query cheap.`,
        id: 'stream-selectivity',
        status: levelForScore(streamsScore),
        title: 'Stream selector selectivity',
      },
    ],
    score: Math.min(bytesScore, streamsScore),
  };
}
