import { dateMath, TimeRange } from '@grafana/data';

/**
 * Helper function to cast `Object.keys` to the correct, narrowed type
 * @param obj - The object to get the keys from
 * @returns The keys of the object
 */
export function getObjectKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

// See https://github.com/grafana/grafana/blob/3aa5f82cc43f29d0b2082691622189cc5d2f50a8/packages/grafana-ui/src/components/DateTimePickers/utils.ts#L19
export function isValidTimeRange(range: TimeRange) {
  return dateMath.isValid(range.from) && dateMath.isValid(range.to);
}
