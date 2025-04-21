import { LogsSortOrder } from '@grafana/data';

export function isLogsSortOrder(value: unknown): value is LogsSortOrder {
  return value === LogsSortOrder.Ascending || value === LogsSortOrder.Descending;
}
