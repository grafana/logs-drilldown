enum TimeOptions {
  seconds = 's',
  minutes = 'm',
  hours = 'h',
  days = 'd',
  weeks = 'w',
  years = 'y',
}

const DURATION_REGEXP = new RegExp(/^(?:(?<value>\d+)(?<type>ms|s|m|h|d|w|y))|0$/);
const INVALID_FORMAT = new Error(
  `Must be of format "(number)(unit)", for example "1m", or just "0". Available units: ${Object.values(
    TimeOptions
  ).join(', ')}`
);

const PROMETHEUS_SUFFIX_MULTIPLIER: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Supports parsing prometheus style durations in the frontend, e.g. 1h10m31s13ms
 *
 * Copied from `/grafana/grafana/public/app/features/alerting/unified/utils/time.ts`
 * @param duration
 */
export function parsePrometheusDuration(duration: string): number {
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

  return totalDuration;
}
