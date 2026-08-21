import { AdHocVariableFilter, FieldType, LoadingState, toDataFrame } from '@grafana/data';
import { AdHocFiltersVariable, sceneGraph, SceneObject } from '@grafana/scenes';

import { FilterOp } from './filterTypes';
import { readLevelsFromCompletedLogsVolumePanel, getLevelsFromLogsVolume, sumLogsVolumeSeries } from './logsVolume';
import { getLevelsVariable } from './variableGetters';
import { VAR_LEVELS } from './variables';
import { LogsVolumePanel } from 'Components/ServiceScene/LogsVolume/LogsVolumePanel';

jest.mock('./variableGetters');

describe('readLevelsFromCompletedLogsVolumePanel', () => {
  it('returns null when the panel is collapsed', () => {
    const volume = new LogsVolumePanel({});
    volume.setState({
      panel: { state: { collapsed: true } } as unknown as LogsVolumePanel['state']['panel'],
    });
    expect(readLevelsFromCompletedLogsVolumePanel(volume)).toBeNull();
  });

  it('returns null when there is no panel', () => {
    const volume = new LogsVolumePanel({});
    expect(readLevelsFromCompletedLogsVolumePanel(volume)).toBeNull();
  });

  it('returns null when the query is not done', () => {
    const volume = new LogsVolumePanel({});
    volume.setState({
      panel: {
        state: {
          collapsed: false,
          $data: {
            state: {
              data: { state: LoadingState.Loading, series: [] },
            },
          },
        },
      } as unknown as LogsVolumePanel['state']['panel'],
    });
    expect(readLevelsFromCompletedLogsVolumePanel(volume)).toBeNull();
  });

  it('returns distinct level names from completed range series', () => {
    const series = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [0, 1] },
          {
            labels: { detected_level: 'error' },
            name: 'Value',
            type: FieldType.number,
            values: [1, 2],
          },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [0, 1] },
          {
            labels: { detected_level: 'warn' },
            name: 'Value',
            type: FieldType.number,
            values: [3, 4],
          },
        ],
      }),
    ];
    const volume = new LogsVolumePanel({});
    volume.setState({
      panel: {
        state: {
          collapsed: false,
          $data: {
            state: {
              data: { state: LoadingState.Done, series },
            },
          },
        },
      } as unknown as LogsVolumePanel['state']['panel'],
    });
    expect(readLevelsFromCompletedLogsVolumePanel(volume)).toEqual(['error', 'warn']);
  });
});

describe('getLevelsFromLogsVolume', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when other pending level filters are non-empty without searching the scene', () => {
    const spy = jest.spyOn(sceneGraph, 'findObject');
    expect(getLevelsFromLogsVolume({} as SceneObject, '| detected_level="error"')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns null when no logs volume panel exists in the scene', () => {
    jest.spyOn(sceneGraph, 'findObject').mockReturnValue(null);
    expect(getLevelsFromLogsVolume({} as SceneObject, '')).toBeNull();
  });
});

describe('sumLogsVolumeSeries', () => {
  const scene = {} as SceneObject;

  function setup(filters: AdHocVariableFilter[]) {
    const levelsVariable = new AdHocFiltersVariable({
      filters,
      name: VAR_LEVELS,
    });
    jest.mocked(getLevelsVariable).mockReturnValue(levelsVariable);
  }

  const series = [
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [0, 1] },
        {
          labels: { detected_level: 'error' },
          name: 'Value',
          type: FieldType.number,
          values: [1, 2],
        },
      ],
    }),
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [0, 1] },
        {
          labels: { detected_level: 'warn' },
          name: 'Value',
          type: FieldType.number,
          values: [3, 4],
        },
      ],
    }),
  ];

  it('sums numeric values across all series when there are no level filters', () => {
    setup([]);
    expect(sumLogsVolumeSeries(series, scene)).toBe(10);
  });

  it('sums only series that match inclusive level filters', () => {
    setup([
      {
        key: 'detected_level',
        operator: FilterOp.Equal,
        value: 'error',
      },
    ]);
    expect(sumLogsVolumeSeries(series, scene)).toBe(3);
  });

  it('excludes series that match exclusive level filters', () => {
    setup([
      {
        key: 'detected_level',
        operator: FilterOp.NotEqual,
        value: 'error',
      },
    ]);
    expect(sumLogsVolumeSeries(series, scene)).toBe(7);
  });

  it('ignores non-finite values and frames without a number field', () => {
    setup([]);
    const mixedSeries = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [0, 1, 2] },
          {
            name: 'Value',
            type: FieldType.number,
            values: [5, Number.NaN, Number.POSITIVE_INFINITY],
          },
        ],
      }),
      toDataFrame({
        fields: [{ name: 'Time', type: FieldType.time, values: [0, 1] }],
      }),
    ];
    expect(sumLogsVolumeSeries(mixedSeries, scene)).toBe(5);
  });

  it('returns 0 for empty series', () => {
    setup([]);
    expect(sumLogsVolumeSeries([], scene)).toBe(0);
  });
});
