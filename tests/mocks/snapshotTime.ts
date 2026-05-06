/**
 * Single fixed snapshot instant used by every e2e test and mock dataset.
 *
 * The captured Loki responses under `tests/mocks/captured/**` and
 * `tests/mocks/labels/**` were all recorded in the same session and cluster
 * around `2026-05-04T15:53:34.305Z`. Aligning navigation URLs (`from`/`to`)
 * and any synthesized timestamps to that exact moment guarantees that the
 * static frames sit inside the active time range and that nothing in the
 * suite depends on `Date.now()`.
 *
 * If you re-capture the mocks, update these two values to match the new
 * window and search the suite for any hardcoded epochs left behind.
 */

// 2026-05-04T15:53:34.305Z — end of the captured /ds/query window
export const SNAPSHOT_TO_MS = 1777910014305;

// 2026-05-04T15:38:34.305Z — start of the captured /ds/query window (15m earlier)
export const SNAPSHOT_FROM_MS = 1777909114305;

export const SNAPSHOT_TO_PARAM = String(SNAPSHOT_TO_MS);
export const SNAPSHOT_FROM_PARAM = String(SNAPSHOT_FROM_MS);
