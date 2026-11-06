import React from 'react';

import { act, render, screen } from '@testing-library/react';

import { dateTime, LoadingState } from '@grafana/data';
import { CustomVariable, sceneGraph, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';

import { QueryStatsScene } from './QueryStatsScene';
import { ServiceScene } from './ServiceScene';
import { LokiDatasource, LokiQueryStats } from 'services/lokiQuery';
import { getDataSource, getLokiDatasource } from 'services/scenes';
import { testIds } from 'services/testIds';
import { VAR_DATASOURCE } from 'services/variables';

jest.mock('services/scenes', () => ({ getDataSource: jest.fn(), getLokiDatasource: jest.fn() }));

const initialQuery = { expr: '{service_name="test"}', queryType: 'range', refId: 'logsPanelQuery' };

describe('QueryStatsScene', () => {
  const getStats = jest.fn<Promise<LokiQueryStats | null>, Parameters<NonNullable<LokiDatasource['getStats']>>>();
  let model: QueryStatsScene;
  let runner: SceneQueryRunner;
  let timeRange: SceneTimeRange;
  let service: ServiceScene;
  let deactivate: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    getStats.mockReset().mockResolvedValue({ bytes: 1024 });
    jest.mocked(getDataSource).mockReturnValue('loki-a');
    const datasource: Partial<LokiDatasource> = { getStats };
    jest.mocked(getLokiDatasource).mockResolvedValue(datasource as LokiDatasource);
    runner = new SceneQueryRunner({ queries: [initialQuery], runQueriesMode: 'manual' });
    timeRange = new SceneTimeRange({ from: 'now-1h', to: 'now' });
    service = new ServiceScene({ $data: runner, $timeRange: timeRange });
    model = new QueryStatsScene();
    service.setState({ queryStats: model });
    deactivate = () => {};
  });

  afterEach(() => {
    deactivate();
    jest.restoreAllMocks();
  });

  async function flushEstimate() {
    await act(async () => {
      if (!model.isActive) {
        deactivate = model.activate();
      }
    });
  }

  function estimate() {
    return screen.getByTestId(testIds.exploreServiceDetails.querySizeEstimate);
  }

  it('clears the estimate and ignores pending responses when the query is removed', async () => {
    let resolveOld: ((stats: LokiQueryStats) => void) | undefined;
    getStats.mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)));
    render(<model.Component model={model} />);
    await flushEstimate();
    act(() => runner.setState({ queries: [] }));
    await act(async () => resolveOld?.({ bytes: 1024 }));
    expect(screen.queryByTestId(testIds.exploreServiceDetails.querySizeEstimate)).not.toBeInTheDocument();
    expect(model.state.stats).toBeUndefined();
  });

  it('inherits the service runner and time range through its owner', () => {
    expect(model.parent).toBe(service);
    expect(sceneGraph.getData(model)).toBe(runner);
    expect(sceneGraph.getTimeRange(model)).toBe(timeRange);
  });

  it('reconnects to the current service runner on reactivation', async () => {
    await flushEstimate();
    deactivate();
    const previous = model.state;
    const replacement = new SceneQueryRunner({ queries: [{ ...initialQuery, expr: '{service_name="replacement"}' }] });
    service.setState({ $data: replacement });
    expect(model.state).toBe(previous);
    deactivate = model.activate();
    await flushEstimate();
    expect(getStats).toHaveBeenLastCalledWith(
      expect.objectContaining({ expr: '{service_name="replacement"}' }),
      timeRange.state.value
    );
    runner.setState({ queries: [{ ...initialQuery, expr: '{service_name="obsolete"}' }] });
    await flushEstimate();
    expect(getStats).toHaveBeenCalledTimes(2);
  });

  it('shows an estimate before any logs result and keeps it while logs load', async () => {
    const runQueries = jest.spyOn(runner, 'runQueries');
    render(<model.Component model={model} />);
    expect(estimate()).toHaveTextContent('Estimating query size');
    expect(runner.state.data).toBeUndefined();

    await flushEstimate();

    expect(getLokiDatasource).toHaveBeenCalledWith(model);
    expect(estimate()).toHaveTextContent('This query processes approximately 1.0 KiB');
    expect(getStats).toHaveBeenCalledWith(
      expect.objectContaining({ ...initialQuery, refId: expect.stringContaining('query-size-') }),
      timeRange.state.value
    );
    act(() => {
      runner.setState({ data: { series: [], state: LoadingState.Loading, timeRange: timeRange.state.value } });
    });
    expect(estimate()).toHaveTextContent('1.0 KiB');
    expect(getStats).toHaveBeenCalledTimes(1);
    expect(runQueries).not.toHaveBeenCalled();
  });

  it('clears old estimates when the query changes', async () => {
    render(<model.Component model={model} />);
    await flushEstimate();
    act(() => {
      runner.setState({ queries: [{ ...initialQuery, expr: '{service_name="third"}', queryType: 'instant' }] });
    });
    expect(estimate()).toHaveTextContent('Estimating query size');
    expect(estimate()).not.toHaveTextContent('KiB');
    await flushEstimate();
    expect(getStats).toHaveBeenCalledTimes(2);
    expect(getStats).toHaveBeenLastCalledWith(
      expect.objectContaining({ expr: '{service_name="third"}', queryType: 'instant' }),
      timeRange.state.value
    );
  });

  it('refreshes for a newly resolved relative range even when raw times are unchanged', async () => {
    await flushEstimate();
    const previous = timeRange.state.value;
    act(() => {
      timeRange.setState({
        value: {
          ...previous,
          from: dateTime(previous.from.valueOf() + 1000),
          to: dateTime(previous.to.valueOf() + 1000),
        },
      });
    });
    await flushEstimate();
    expect(getStats).toHaveBeenCalledTimes(2);
    expect(getStats).toHaveBeenLastCalledWith(expect.anything(), timeRange.state.value);
  });

  it('keeps the current estimate for equivalent inputs and whitespace-only query changes', async () => {
    render(<model.Component model={model} />);
    await flushEstimate();
    act(() => {
      runner.setState({ queries: [{ ...initialQuery, expr: ` ${initialQuery.expr} ` }] });
      timeRange.setState({ value: { ...timeRange.state.value } });
    });
    expect(estimate()).toHaveTextContent('1.0 KiB');
    await flushEstimate();
    expect(getStats).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the selected datasource changes with the same query', async () => {
    await flushEstimate();
    jest.mocked(getDataSource).mockReturnValue('loki-b');
    act(() => {
      model.variableDependency?.variableUpdateCompleted(new CustomVariable({ name: VAR_DATASOURCE }), true);
    });
    await flushEstimate();
    expect(getLokiDatasource).toHaveBeenCalledTimes(2);
    expect(getStats).toHaveBeenCalledTimes(2);
  });

  it('ignores a pending response after query inputs change', async () => {
    let resolveOld: ((stats: LokiQueryStats) => void) | undefined;
    getStats.mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)));
    render(<model.Component model={model} />);
    await flushEstimate();
    act(() => runner.setState({ queries: [{ ...initialQuery, expr: '{service_name="new"}' }] }));
    await flushEstimate();
    await act(async () => resolveOld?.({ bytes: 1024 * 1024 }));
    expect(estimate()).toHaveTextContent('1.0 KiB');
  });

  it('ignores pending responses after deactivation and refreshes on reactivation', async () => {
    let resolveOld: ((stats: LokiQueryStats) => void) | undefined;
    getStats.mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)));
    await flushEstimate();
    deactivate();
    const deactivatedState = model.state;
    await act(async () => resolveOld?.({ bytes: 1024 * 1024 }));
    expect(model.state).toBe(deactivatedState);
    deactivate = model.activate();
    await flushEstimate();
    expect(model.state.stats?.bytes).toBe(1024);
    expect(getStats).toHaveBeenCalledTimes(2);
  });

  it.each([null, { bytes: 0 }, { bytes: NaN }, { bytes: -1 }])('does not invent an estimate for %p', async (stats) => {
    getStats.mockResolvedValue(stats);
    render(<model.Component model={model} />);
    await flushEstimate();
    expect(estimate()).toHaveTextContent('Query size estimate unavailable');
  });

  it('handles failed requests without triggering logs queries', async () => {
    const runQueries = jest.spyOn(runner, 'runQueries');
    getStats.mockRejectedValue(new Error('unavailable'));
    render(<model.Component model={model} />);
    await flushEstimate();
    expect(estimate()).toHaveTextContent('Query size estimate unavailable');
    expect(runQueries).not.toHaveBeenCalled();
  });

  it('handles datasources without stats support', async () => {
    jest.mocked(getLokiDatasource).mockResolvedValue({} as LokiDatasource);
    render(<model.Component model={model} />);
    await flushEstimate();
    expect(estimate()).toHaveTextContent('Query size estimate unavailable');
    expect(getStats).not.toHaveBeenCalled();
  });

  it('renders datasource messages as plain text', async () => {
    getStats.mockResolvedValue({ bytes: 0, message: '<b>Estimate not available</b>' });
    render(<model.Component model={model} />);
    await flushEstimate();
    expect(estimate()).toHaveTextContent('<b>Estimate not available</b>');
    expect(estimate().querySelector('b')).toBeNull();
  });
});
