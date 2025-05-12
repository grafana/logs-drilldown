import { LogsDedupStrategy, LogsSortOrder } from '@grafana/data';

export function isLogsSortOrder(value: unknown): value is LogsSortOrder {
  return value === LogsSortOrder.Ascending || value === LogsSortOrder.Descending;
}

export function isDedupStrategy(strategy: unknown): strategy is LogsDedupStrategy {
  const strategies = Object.values(LogsDedupStrategy).map((coreApp) => coreApp.toString());
  return typeof strategy === 'string' && strategies.includes(strategy);
}
