import { LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords } from '@grafana/api-clients/rtkq/logsdrilldown/v1beta1';
import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';

import { getDefaultColumnsForActiveFilters } from './defaultColumns';
import { FilterOp } from './filterTypes';
import { getLabelsVariable } from './variableGetters';
import { addAdHocFilterUserInputPrefix, VAR_LABELS } from './variables';

jest.mock('./variableGetters', () => ({
  ...jest.requireActual('./variableGetters'),
  getLabelsVariable: jest.fn(),
}));

type Filter = { key: string; operator: string; value: string };

function mockLabelsFilters(filters: Filter[]) {
  jest.mocked(getLabelsVariable).mockReturnValue(
    new AdHocFiltersVariable({
      name: VAR_LABELS,
      filters,
    })
  );
}

const sceneRef = {} as SceneObject;

describe('getDefaultColumnsForActiveFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined when there are no records', () => {
    mockLabelsFilters([{ key: 'service_name', operator: FilterOp.Equal, value: 'api' }]);
    expect(getDefaultColumnsForActiveFilters([], sceneRef)).toBeUndefined();
  });

  it('returns undefined when no record scores above zero', () => {
    mockLabelsFilters([{ key: 'service_name', operator: FilterOp.Equal, value: 'api' }]);
    const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
      { columns: ['level', 'msg'], labels: [{ key: 'service_name', value: 'other' }] },
    ];
    expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toBeUndefined();
  });

  it('returns the columns of the matching record', () => {
    mockLabelsFilters([{ key: 'service_name', operator: FilterOp.Equal, value: 'api' }]);
    const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
      { columns: ['level', 'msg'], labels: [{ key: 'service_name', value: 'api' }] },
    ];
    expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toEqual(['level', 'msg']);
  });

  it('picks the record with the highest score', () => {
    mockLabelsFilters([
      { key: 'service_name', operator: FilterOp.Equal, value: 'api' },
      { key: 'namespace', operator: FilterOp.Equal, value: 'prod' },
    ]);
    const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
      { columns: ['single'], labels: [{ key: 'service_name', value: 'api' }] },
      {
        columns: ['both'],
        labels: [
          { key: 'service_name', value: 'api' },
          { key: 'namespace', value: 'prod' },
        ],
      },
    ];
    expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toEqual(['both']);
  });

  it('ignores records that are more specific than the active filter set', () => {
    mockLabelsFilters([{ key: 'service_name', operator: FilterOp.Equal, value: 'api' }]);
    const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
      {
        columns: ['too-specific'],
        labels: [
          { key: 'service_name', value: 'api' },
          { key: 'namespace', value: 'prod' },
        ],
      },
    ];
    expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toBeUndefined();
  });

  it('ignores non-inclusive filters', () => {
    mockLabelsFilters([{ key: 'service_name', operator: FilterOp.NotEqual, value: 'api' }]);
    const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
      { columns: ['level'], labels: [{ key: 'service_name', value: 'api' }] },
    ];
    expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toBeUndefined();
  });

  describe('multi-value regex filters', () => {
    it('expands `key=~__CVΩ__value1|value2` and matches a record with both values', () => {
      mockLabelsFilters([
        {
          key: 'service_name',
          operator: FilterOp.RegexEqual,
          value: addAdHocFilterUserInputPrefix('api|web'),
        },
      ]);
      const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
        {
          columns: ['multi'],
          labels: [
            { key: 'service_name', value: 'api' },
            { key: 'service_name', value: 'web' },
          ],
        },
      ];
      expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toEqual(['multi']);
    });

    it('matches a record referencing a single one of the piped values', () => {
      mockLabelsFilters([
        {
          key: 'service_name',
          operator: FilterOp.RegexEqual,
          value: addAdHocFilterUserInputPrefix('api|web'),
        },
      ]);
      const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
        { columns: ['just-web'], labels: [{ key: 'service_name', value: 'web' }] },
      ];
      expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toEqual(['just-web']);
    });

    it('prefers the record that matches more of the expanded values', () => {
      mockLabelsFilters([
        {
          key: 'service_name',
          operator: FilterOp.RegexEqual,
          value: addAdHocFilterUserInputPrefix('api|web|db'),
        },
      ]);
      const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
        { columns: ['one'], labels: [{ key: 'service_name', value: 'api' }] },
        {
          columns: ['two'],
          labels: [
            { key: 'service_name', value: 'api' },
            { key: 'service_name', value: 'db' },
          ],
        },
      ];
      expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toEqual(['two']);
    });

    it('expands values when scoring alongside other filters', () => {
      mockLabelsFilters([
        {
          key: 'service_name',
          operator: FilterOp.RegexEqual,
          value: addAdHocFilterUserInputPrefix('api|web'),
        },
        { key: 'namespace', operator: FilterOp.Equal, value: 'prod' },
      ]);
      const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
        {
          columns: ['match'],
          labels: [
            { key: 'service_name', value: 'web' },
            { key: 'namespace', value: 'prod' },
          ],
        },
      ];
      expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toEqual(['match']);
    });

    it('does not expand a regex filter without the user-input prefix', () => {
      mockLabelsFilters([{ key: 'service_name', operator: FilterOp.RegexEqual, value: 'api|web' }]);
      const records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords = [
        {
          columns: ['multi'],
          labels: [
            { key: 'service_name', value: 'api' },
            { key: 'service_name', value: 'web' },
          ],
        },
        { columns: ['literal'], labels: [{ key: 'service_name', value: 'api|web' }] },
      ];
      expect(getDefaultColumnsForActiveFilters(records, sceneRef)).toEqual(['literal']);
    });
  });
});
