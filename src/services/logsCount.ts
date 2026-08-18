import { getValueFormat } from '@grafana/data';

// Shared short-format for log counts, e.g. 1234 -> "1K", shown in tab badge and panel titles
export function formatLogsCount(count: number): string {
  const formatted = getValueFormat('short')(count, 0);
  return `${formatted.text}${formatted.suffix?.trim() ?? ''}`;
}

// Count shown in tab badge and volume title: exact when under the line limit, else the approximate instant total (#2049)
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
