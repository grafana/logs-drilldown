// Adapted from parsePrometheusDuration from /grafana/grafana/public/app/features/alerting/unified/utils/time.ts
// @todo push up to core?
// @todo negative numbers
// @todo unit tests

export enum TimeOptions {
  nanoSeconds = 'ns',
  microSeconds = 'µs',
  milliseconds = 'ms',
  seconds = 's',
  minutes = 'm',
  hours = 'h',
  days = 'd',
  weeks = 'w',
  years = 'y',
}

const PROMETHEUS_SUFFIX_MULTIPLIER: Record<string, number> = {
  ns: 1 / 1000 / 1000,
  µs: 1 / 1000,
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

const DURATION_REGEXP = new RegExp(/^(?:(?<value>\d+(?:\.\d+)?)(?<type>ns|µs|ms|s|m|h|d|w|y))|0$/);
const INVALID_FORMAT = new Error(
  `Must be of format "(number)(unit)", for example "1m", or just "0". Available units: ${Object.values(
    TimeOptions
  ).join(', ')}`
);

/**
 * Parses interval strings from Loki
 * e.g. 949.96µs, -38m10.878295379s, 147h11m43.529675258s
 */
export function parseLokiDuration(duration: string): number {
  // Don't know how durations can be negative, but loki sends em' back?
  const multiplier = duration[0] === '-' ? -1 : 1;
  if (multiplier === -1) {
    duration = duration.slice(1);
  }

  let input = duration;
  const parts: Array<[number, string]> = [];

  function matchDuration(part: string) {
    const match = DURATION_REGEXP.exec(part);
    const hasValueAndType = match?.groups?.value && match?.groups?.type;

    if (!match || !hasValueAndType) {
      throw INVALID_FORMAT;
    }

    if (match && match.groups?.value && match.groups?.type) {
      input = input.replace(match[0], '');
      parts.push([Number(match.groups.value), match.groups.type]);
    }

    if (input) {
      matchDuration(input);
    }
  }

  matchDuration(duration);

  if (!parts.length) {
    throw INVALID_FORMAT;
  }

  const totalDuration = parts.reduce((acc, [value, type]) => {
    const duration = value * PROMETHEUS_SUFFIX_MULTIPLIER[type];
    return acc + duration;
  }, 0);

  return totalDuration * multiplier;
}
