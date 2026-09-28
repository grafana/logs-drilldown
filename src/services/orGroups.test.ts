import { filterDissolvingOrGroups, makeOrGroupsContiguous, normalizeOrGroups, OrGroupAccessor } from './orGroups';

type Item = { name: string; orGroup?: number };

const accessor: OrGroupAccessor<Item> = {
  get: (item) => item.orGroup,
  set: (item, orGroup) => ({ ...item, orGroup }),
};

describe('normalizeOrGroups', () => {
  it('drops groups with a single member and renumbers by first appearance', () => {
    expect(
      normalizeOrGroups(
        [
          { name: 'a', orGroup: 7 },
          { name: 'b', orGroup: 3 },
          { name: 'c', orGroup: 7 },
          { name: 'd' },
          { name: 'e', orGroup: 5 },
          { name: 'f', orGroup: 5 },
        ],
        accessor
      )
    ).toEqual([
      { name: 'a', orGroup: 1 },
      { name: 'b', orGroup: undefined },
      { name: 'c', orGroup: 1 },
      { name: 'd' },
      { name: 'e', orGroup: 2 },
      { name: 'f', orGroup: 2 },
    ]);
  });

  it('returns the same items when nothing changes', () => {
    const items: Item[] = [{ name: 'a', orGroup: 1 }, { name: 'b', orGroup: 1 }, { name: 'c' }];
    const normalized = normalizeOrGroups(items, accessor);
    normalized.forEach((item, index) => expect(item).toBe(items[index]));
  });
});

describe('filterDissolvingOrGroups', () => {
  it('removes every member of an OR group that loses a member', () => {
    const items: Item[] = [
      { name: 'a', orGroup: 1 },
      { name: 'b', orGroup: 1 },
      { name: 'c' },
      { name: 'd', orGroup: 2 },
      { name: 'e', orGroup: 2 },
    ];

    expect(filterDissolvingOrGroups(items, (item) => item.name !== 'b', accessor.get)).toEqual([
      { name: 'c' },
      { name: 'd', orGroup: 2 },
      { name: 'e', orGroup: 2 },
    ]);
  });
});

describe('makeOrGroupsContiguous', () => {
  it('moves OR group members next to the first member', () => {
    const items: Item[] = [{ name: 'a', orGroup: 1 }, { name: 'b' }, { name: 'c', orGroup: 1 }, { name: 'd' }];

    expect(makeOrGroupsContiguous(items, accessor.get).map((item) => item.name)).toEqual(['a', 'c', 'b', 'd']);
  });
});
