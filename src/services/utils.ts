/**
 * Helper function to cast `Object.keys` to the correct, narrowed type
 * @param obj - The object to get the keys from
 * @returns The keys of the object
 */
export function getObjectKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}
