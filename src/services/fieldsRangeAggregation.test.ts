import { buildFieldsQuery } from './fields';

jest.mock('./variableGetters', () => ({
  ...jest.requireActual('./variableGetters'),
  getLogsStreamSelector: jest.fn(() => '{selector}'),
}));

describe('buildFieldsQuery with rangeAggregation', () => {
  it('keeps avg_over_time as the default for numeric fields', () => {
    expect(buildFieldsQuery('latency', { fieldType: 'duration' })).toBe(
      'avg_over_time({selector} | unwrap duration(latency) | __error__="" [$__auto]) by ()'
    );
    expect(buildFieldsQuery('ratio', { fieldType: 'float' })).toBe(
      'avg_over_time({selector} | unwrap ratio | __error__="" [$__auto]) by ()'
    );
  });

  it.each(['max', 'min'] as const)('uses %s_over_time and converts durations and bytes', (rangeAggregation) => {
    expect(buildFieldsQuery('latency', { fieldType: 'duration', rangeAggregation })).toBe(
      `${rangeAggregation}_over_time({selector} | unwrap duration(latency) | __error__="" [$__auto]) by ()`
    );
    expect(buildFieldsQuery('size', { fieldType: 'bytes', rangeAggregation })).toBe(
      `${rangeAggregation}_over_time({selector} | unwrap bytes(size) | __error__="" [$__auto]) by ()`
    );
  });

  it('unwraps int fields instead of counting them when an aggregation is requested', () => {
    expect(buildFieldsQuery('status', { fieldType: 'int', rangeAggregation: 'max' })).toBe(
      'max_over_time({selector} | unwrap status | __error__="" [$__auto]) by ()'
    );
    expect(buildFieldsQuery('status', { fieldType: 'int' })).toContain('count_over_time');
  });

  it('unwraps fields without a detected type or detected as strings', () => {
    expect(buildFieldsQuery('code', { rangeAggregation: 'min' })).toBe(
      'min_over_time({selector} | unwrap code | __error__="" [$__auto]) by ()'
    );
    expect(buildFieldsQuery('code', { fieldType: 'string', rangeAggregation: 'max' })).toBe(
      'max_over_time({selector} | unwrap code | __error__="" [$__auto]) by ()'
    );
  });
});
