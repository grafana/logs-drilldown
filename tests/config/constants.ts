/**
 * Fixed time-range search params used by the static-data e2e suite.
 *
 * The Loki snapshot built by `pnpm run generate:loki-snapshot` covers
 * the window 2025-05-26T11:00:00Z .. 2025-05-26T12:05:00Z (see
 * `tests/static-loki/README.md`). Tests should navigate using these values instead of
 * `now-*&to=now`, otherwise queries return no data.
 */

export const STATIC_FROM = '2025-05-26T11:00:00.000Z';
export const STATIC_TO = '2025-05-26T12:05:00.000Z';

export const DEFAULT_STATIC_URL_SEARCH_PARAMS = new URLSearchParams({
  'var-ds': 'gdev-loki',
  from: STATIC_FROM,
  to: STATIC_TO,
  timezone: 'utc',
});
