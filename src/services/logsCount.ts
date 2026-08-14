import { getValueFormat } from '@grafana/data';

// Shared short-format for log counts, e.g. 1234 -> "1K", shown in tab badge and panel titles
export function formatLogsCount(count: number): string {
  const formatted = getValueFormat('short')(count, 0);
  return `${formatted.text}${formatted.suffix?.trim() ?? ''}`;
}

/**
 * Picks the logs count to display in the tab badge and log volume title.
 * Prefers the exact returned-line count when under the line limit (the query returned everything);
 * falls back to the instant count query total, which is approximate (see #2049).
 */
export function getDisplayedLogsCount(
  totalLogsCount: number | undefined,
  logsCount: number | undefined,
  maxLines: number
): number | undefined {
  if (logsCount !== undefined && logsCount < maxLines) {
    return logsCount;
  }
  return totalLogsCount;
}
