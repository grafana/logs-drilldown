import { getCountOptionsFromTotal } from './ServiceSelectionPaginationScene';

describe('getCountOptionsFromTotal()', () => {
  test('Generates pagination options', () => {
    const options = getCountOptionsFromTotal(61);
    expect(options).toEqual([
      { label: '20', value: '20' },
      { label: '40', value: '40' },
      { label: '60', value: '60' },
    ]);
  });

  test('Generates pagination options up to the total count', () => {
    expect(getCountOptionsFromTotal(60)).toEqual([
      { label: '20', value: '20' },
      { label: '40', value: '40' },
      { label: '60', value: '60' },
    ]);
    expect(getCountOptionsFromTotal(59)).toEqual([
      { label: '20', value: '20' },
      { label: '40', value: '40' },
      { label: '59', value: '60' },
    ]);
    expect(getCountOptionsFromTotal(40)).toEqual([
      { label: '20', value: '20' },
      { label: '40', value: '40' },
    ]);
    expect(getCountOptionsFromTotal(39)).toEqual([
      { label: '20', value: '20' },
      { label: '39', value: '40' },
    ]);
    expect(getCountOptionsFromTotal(20)).toEqual([{ label: '20', value: '20' }]);
    expect(getCountOptionsFromTotal(19)).toEqual([{ label: '19', value: '20' }]);
    expect(getCountOptionsFromTotal(1)).toEqual([{ label: '1', value: '20' }]);
  });
});
