import { areLabelFiltersEqual } from './variableHelpers';

describe('variableHelpers', () => {
  test('areLabelFiltersEqual', () => {
    const a = [
      { key: 'k1', operator: '=', value: 'v1' },
      { key: 'k2', operator: '!=', value: 'v2' },
    ];
    const b = [
      { key: 'k2', operator: '!=', value: 'v2' },
      { key: 'k1', operator: '=', value: 'v1' },
    ];
    const c = [
      { key: 'k1', operator: '=', value: 'v1' },
      { key: 'k2', operator: '=', value: 'v2' },
    ];
    const d = [
      { key: 'k1', operator: '=', value: 'v1' },
      { key: 'k2', operator: '!=', value: 'v3' },
    ];
    const e = [{ key: 'k1', operator: '=', value: 'v1' }];
    const f = [
      { key: 'k1', operator: '=', value: 'v1' },
      { key: 'k2', operator: '!=', value: 'v2', foo: 1 },
    ];

    expect(areLabelFiltersEqual(a, b)).toBe(true);
    expect(areLabelFiltersEqual(a, c)).toBe(false);
    expect(areLabelFiltersEqual(a, d)).toBe(false);
    expect(areLabelFiltersEqual(a, e)).toBe(false);
    expect(areLabelFiltersEqual(a, f)).toBe(true);
  });
});
