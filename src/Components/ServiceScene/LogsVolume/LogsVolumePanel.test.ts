import { sceneGraph, VizPanel } from '@grafana/scenes';

import { LogsVolumePanel } from './LogsVolumePanel';
import { LogsVolumeActions } from 'Components/ServiceScene/LogsVolumeActions';
import { getFeatureFlag } from 'featureFlags/openFeature';
import { getQueryRunnerFromProvider } from 'services/panel';
import { setLogsVolumeAggregateBy } from 'services/store';
import { LEVEL_VARIABLE_VALUE } from 'services/variables';

jest.mock('featureFlags/openFeature', () => ({
  getFeatureFlag: jest.fn(() => true),
}));

jest.mock('services/expressions', () => ({
  getLogsVolumeQuery: jest.fn(
    (_scene: unknown, field: string) => `sum(count_over_time({job="app"}[$__auto])) by (${field})`
  ),
  excludeAggregateByFromLogsVolumeQuery: jest.fn((expr: string) => expr),
}));

jest.mock('services/store', () => ({
  getLogsVolumeAggregateBy: jest.fn(),
  getLogsVolumeOption: jest.fn(),
  getMaxLines: jest.fn(() => 1000),
  setLogsVolumeAggregateBy: jest.fn(),
  setLogsVolumeOption: jest.fn(),
}));

function createPanel(aggregateBy: string) {
  const actions = new LogsVolumeActions({
    aggregateBy,
    onAggregateByChange: () => {},
  });
  const panel = {
    state: {
      $data: { subscribeToState: jest.fn() },
      collapsed: false,
      headerActions: actions,
    },
    setState(this: { state: Record<string, unknown> }, state: Record<string, unknown>) {
      this.state = { ...this.state, ...state };
    },
  };
  return { actions, panel: panel as unknown as VizPanel };
}

describe('LogsVolumePanel.setAggregateBy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getFeatureFlag).mockReturnValue(true);
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: { $data: undefined },
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the panel and updates the query and header actions', () => {
    const volume = new LogsVolumePanel({});
    const { actions, panel } = createPanel(LEVEL_VARIABLE_VALUE);
    volume.setState({ panel });

    volume.setAggregateBy('pod');

    expect(volume.state.panel).toBe(panel);
    expect(volume.state.aggregateBy).toBe('pod');
    expect(actions.state.aggregateBy).toBe('pod');
    expect(setLogsVolumeAggregateBy).toHaveBeenCalledWith(volume, 'pod');

    const queryRunner = getQueryRunnerFromProvider(panel.state.$data!);
    const query = queryRunner.state.queries[0];
    expect(query.legendFormat).toBe('{{pod}}');
    expect(query.expr).toContain('by (pod)');
  });

  it('does not change aggregation when the feature flag is disabled', () => {
    jest.mocked(getFeatureFlag).mockReturnValue(false);
    const volume = new LogsVolumePanel({});
    const { actions, panel } = createPanel(LEVEL_VARIABLE_VALUE);
    volume.setState({ panel });
    const dataBefore = panel.state.$data;

    volume.setAggregateBy('pod');

    expect(volume.state.aggregateBy).toBe(LEVEL_VARIABLE_VALUE);
    expect(actions.state.aggregateBy).toBe(LEVEL_VARIABLE_VALUE);
    expect(panel.state.$data).toBe(dataBefore);
    expect(setLogsVolumeAggregateBy).not.toHaveBeenCalled();
  });

  it('does not replace the panel when the field is unchanged', () => {
    const volume = new LogsVolumePanel({});
    const { panel } = createPanel(LEVEL_VARIABLE_VALUE);
    volume.setState({ panel });
    const dataBefore = panel.state.$data;

    volume.setAggregateBy(LEVEL_VARIABLE_VALUE);

    expect(volume.state.panel).toBe(panel);
    expect(panel.state.$data).toBe(dataBefore);
    expect(setLogsVolumeAggregateBy).not.toHaveBeenCalled();
  });
});
