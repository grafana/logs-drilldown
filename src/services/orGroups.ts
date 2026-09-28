// Warning: This file is included in the main bundle via links.ts, please do not add any imports to this file!

// Field filters sharing an OR group render as one `| a="1" or b="2"` stage, groups and standalone filters are ANDed
export interface OrGroupAccessor<T> {
  get: (item: T) => number | undefined;
  set: (item: T, orGroup: number | undefined) => T;
}

/** Drops OR groups with a single member and renumbers the remaining groups by order of first appearance */
export function normalizeOrGroups<T>(items: T[], accessor: OrGroupAccessor<T>): T[] {
  const memberCounts = new Map<number, number>();
  items.forEach((item) => {
    const orGroup = accessor.get(item);
    if (orGroup !== undefined) {
      memberCounts.set(orGroup, (memberCounts.get(orGroup) ?? 0) + 1);
    }
  });

  const renumbered = new Map<number, number>();
  return items.map((item) => {
    const orGroup = accessor.get(item);
    if (orGroup === undefined) {
      return item;
    }
    if ((memberCounts.get(orGroup) ?? 0) < 2) {
      return accessor.set(item, undefined);
    }

    let nextOrGroup = renumbered.get(orGroup);
    if (nextOrGroup === undefined) {
      nextOrGroup = renumbered.size + 1;
      renumbered.set(orGroup, nextOrGroup);
    }
    return nextOrGroup === orGroup ? item : accessor.set(item, nextOrGroup);
  });
}

/** Removes items failing the predicate along with the rest of their OR group, as a partial OR group narrows results */
export function filterDissolvingOrGroups<T>(
  items: T[],
  keep: (item: T) => boolean,
  getOrGroup: (item: T) => number | undefined
): T[] {
  const dissolvedOrGroups = new Set<number>();
  items.forEach((item) => {
    const orGroup = getOrGroup(item);
    if (orGroup !== undefined && !keep(item)) {
      dissolvedOrGroups.add(orGroup);
    }
  });

  return items.filter((item) => {
    const orGroup = getOrGroup(item);
    return keep(item) && (orGroup === undefined || !dissolvedOrGroups.has(orGroup));
  });
}

/** Moves the members of each OR group next to its first member, keeping the order otherwise stable */
export function makeOrGroupsContiguous<T>(items: T[], getOrGroup: (item: T) => number | undefined): T[] {
  const result: T[] = [];
  const placedOrGroups = new Set<number>();

  items.forEach((item) => {
    const orGroup = getOrGroup(item);
    if (orGroup === undefined) {
      result.push(item);
      return;
    }
    if (placedOrGroups.has(orGroup)) {
      return;
    }
    placedOrGroups.add(orGroup);
    result.push(...items.filter((member) => getOrGroup(member) === orGroup));
  });

  return result;
}
