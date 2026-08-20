import { FieldType, LoadingState, toDataFrame } from '@grafana/data';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { readLevelsFromCompletedLogsVolumePanel, getLevelsFromLogsVolume, sumLogsVolumeSeries } from './logsVolume';
import { LogsVolumePanel } from 'Components/ServiceScene/LogsVolume/LogsVolumePanel';

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
  it('sums numeric values across all series', () => {
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
    expect(sumLogsVolumeSeries(series)).toBe(10);
  });

  it('ignores non-finite values and frames without a number field', () => {
    const series = [
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
    expect(sumLogsVolumeSeries(series)).toBe(5);
  });

  it('returns 0 for empty series', () => {
    expect(sumLogsVolumeSeries([])).toBe(0);
  });
});
