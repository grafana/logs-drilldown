import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Observable, of } from 'rxjs';

import { DataSourcePluginMeta, dateTime, FieldType, LoadingState, toDataFrame } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { config, DataSourceWithBackend } from '@grafana/runtime';

import Patterns from './Patterns';
import { getEmbededPatterns, getPatternLogs } from 'services/patterns';
import { testIds } from 'services/testIds';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelRenderer: () => <div>Native logs renderer</div>,
}));

jest.mock('@grafana/plugin-compat/datasources', () => ({ getDataSourceInstance: jest.fn() }));

const to = dateTime();
const from = dateTime(to.valueOf() - 15 * 60 * 1000);
const props = { timeRange: { from, to, raw: { from, to } }, datasourceUid: 'loki', query: '{app="api"} |= "failed"' };
const pattern = 'request <_> failed';
const response = { data: [{ pattern, level: 'error', samples: [[1, 12]] }] };

function setup() {
  const ds = new DataSourceWithBackend({
    uid: 'loki',
    id: 0,
    type: 'loki',
    name: 'loki',
    access: 'proxy',
    jsonData: {},
    meta: {} as DataSourcePluginMeta,
    readOnly: false,
  });

  jest.mocked(getDataSourceInstance).mockResolvedValue(ds);

  return jest.spyOn(ds, 'getResource').mockResolvedValue(response);
}

beforeAll(() => {
  global.ResizeObserver = jest
    .fn()
    .mockImplementation(() => ({ observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }));
});

afterEach(() => jest.restoreAllMocks());

it('loads independently from the explicit Loki datasource using only the stream selector and merges levels', async () => {
  const getResource = setup();
  getResource.mockResolvedValue({
    data: [
      ...response.data,
      {
        pattern,
        level: 'warn',
        samples: [
          [1, 3],
          [2, 2],
        ],
      },
    ],
  });
  const from = dateTime(1000);
  const to = dateTime(2000);
  const result = await getEmbededPatterns(
    props.datasourceUid,
    props.query,
    { from, to, raw: { from, to } },
    new AbortController().signal
  );
  expect(getDataSourceInstance).toHaveBeenCalledWith({ uid: 'loki' });
  expect(getResource).toHaveBeenCalledWith(
    'patterns',
    expect.objectContaining({ query: '{app="api"}', start: from.toISOString(), end: to.toISOString() }),
    expect.objectContaining({ showErrorAlert: false })
  );
  expect(getResource.mock.calls[0]?.[1]).not.toHaveProperty('step');
  expect(getResource.mock.calls[0]?.[2]).not.toHaveProperty('requestId');
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ pattern, sum: 17, levels: ['error', 'warn'] });
  expect(result[0]?.dataFrame.fields.map((field) => field.values)).toEqual([
    [1000, 2000],
    [15, 2],
  ]);
});

it('shows loading, backend errors, and reloads when host inputs change', async () => {
  const getResource = setup();
  let reject: (error: object) => void = () => {};
  getResource.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      })
  );
  const { rerender } = render(<Patterns {...props} />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  await waitFor(() => expect(getResource).toHaveBeenCalledTimes(1));
  await act(async () => reject({ data: { message: 'Loki unavailable' } }));
  expect(screen.getByText('Loki unavailable')).toBeInTheDocument();
  getResource.mockResolvedValueOnce({ data: [] });
  rerender(<Patterns {...props} query='{app="other"}' />);
  expect(await screen.findByText('Sorry, we could not detect any patterns.')).toBeInTheDocument();
});

it('supports search without navigating or exposing include/exclude controls', async () => {
  setup();
  const url = location.href;
  render(<Patterns {...props} />);
  await screen.findByText(pattern);
  expect(screen.queryByRole('button', { name: 'Include' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Exclude' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByTestId(testIds.exposedComponents.patterns.search), {
    target: { value: 'absent' },
  });
  expect(screen.getByText('No patterns match these filters.')).toBeInTheDocument();
  expect(location.href).toBe(url);
});

it('refreshes query, datasource, and time inputs and ignores stale responses', async () => {
  const getResource = setup();
  let finish: (value: typeof response) => void = () => {};
  getResource.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const view = render(<Patterns {...props} />);
  await waitFor(() => expect(getResource).toHaveBeenCalledTimes(1));
  const from = dateTime(3000);
  const to = dateTime(4000);
  view.rerender(
    <Patterns {...props} query='{app="worker"}' datasourceUid="other" timeRange={{ from, to, raw: { from, to } }} />
  );
  expect(await screen.findByText(pattern)).toBeInTheDocument();
  expect(getDataSourceInstance).toHaveBeenLastCalledWith({ uid: 'other' });
  expect(getResource).toHaveBeenLastCalledWith(
    'patterns',
    expect.objectContaining({ query: '{app="worker"}', start: from.toISOString(), end: to.toISOString() }),
    expect.anything()
  );
  await act(async () => finish({ data: [] }));
  expect(screen.getByText(pattern)).toBeInTheDocument();
  view.unmount();
});

it('preserves the old-range explanation', async () => {
  const getResource = setup();
  getResource.mockResolvedValue({ data: [] });
  const from = dateTime(Date.now() - 5 * 3600000);
  const to = dateTime(Date.now() - 4 * 3600000);
  render(<Patterns {...props} timeRange={{ from, to, raw: { from, to } }} />);
  expect(await screen.findByText(/Patterns are only available for the most recent 3 hours/)).toBeInTheDocument();
});

const sampleFrame = toDataFrame({
  fields: [
    { name: 'Time', type: FieldType.time, values: [1000] },
    { name: 'Line', type: FieldType.string, values: ['request 123 failed'] },
  ],
});

it('loads logs only on expansion, renders the native logs panel, and closes without navigation', async () => {
  setup();
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  const query = jest
    .spyOn(DataSourceWithBackend.prototype, 'query')
    .mockReturnValue(of({ data: [sampleFrame], state: LoadingState.Done }));
  const url = location.href;
  render(<Patterns {...props} />);
  await screen.findByText(pattern);
  expect(query).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Toggle row expanded' }));
  expect(screen.getByText('Loading pattern logs...')).toBeInTheDocument();
  expect(await screen.findByText('Native logs renderer')).toBeInTheDocument();
  expect(query.mock.calls[0]?.[0]).toMatchObject({
    range: props.timeRange,
    targets: [{ expr: '{app="api"} |> "request <_> failed" |= "failed"', maxLines: 1000 }],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Toggle row expanded' }));
  expect(screen.queryByTestId(testIds.exposedComponents.patterns.logs)).not.toBeInTheDocument();
  expect(location.href).toBe(url);
});

it('falls back to selector-only samples when host filters return no logs', async () => {
  setup();
  const query = jest
    .spyOn(DataSourceWithBackend.prototype, 'query')
    .mockReturnValueOnce(of({ data: [], state: LoadingState.Done }))
    .mockReturnValueOnce(of({ data: [sampleFrame], state: LoadingState.Done }));
  render(<Patterns {...props} />);
  await screen.findByText(pattern);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle row expanded' }));
  expect(await screen.findByText('Showing logs without query filters')).toBeInTheDocument();
  expect(query.mock.calls[1]?.[0].targets[0]?.expr).toBe('{app="api"} |> "request <_> failed"');
});

it('shows sample errors and empty samples', async () => {
  setup();
  const query = jest
    .spyOn(DataSourceWithBackend.prototype, 'query')
    .mockReturnValueOnce(of({ data: [], state: LoadingState.Error, errors: [{ message: 'Sample query failed' }] }))
    .mockReturnValue(of({ data: [], state: LoadingState.Done }));
  render(<Patterns {...props} />);
  await screen.findByText(pattern);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle row expanded' }));
  expect(await screen.findByText('Sample query failed')).toBeInTheDocument();
  expect(query).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle row expanded' }));
  fireEvent.click(screen.getByRole('button', { name: 'Toggle row expanded' }));
  expect(await screen.findByText('This pattern returns no logs.')).toBeInTheDocument();
});

it('unsubscribes a pending sample request when aborted', async () => {
  setup();
  const unsubscribed = jest.fn();
  jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(new Observable(() => unsubscribed));
  const controller = new AbortController();
  const pending = getPatternLogs(props.datasourceUid, props.query, pattern, props.timeRange, controller.signal);
  const rejected = expect(pending).rejects.toThrow();
  await act(async () => {});
  controller.abort();
  await rejected;
  expect(unsubscribed).toHaveBeenCalledTimes(1);
});

it('cancels expanded samples and reloads them when the host time range changes', async () => {
  setup();
  const unsubscribed = jest.fn();
  const query = jest
    .spyOn(DataSourceWithBackend.prototype, 'query')
    .mockReturnValueOnce(new Observable(() => unsubscribed))
    .mockReturnValue(of({ data: [], state: LoadingState.Done }));
  const view = render(<Patterns {...props} />);
  await screen.findByText(pattern);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle row expanded' }));
  await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
  const from = dateTime(5000);
  const to = dateTime(6000);
  view.rerender(<Patterns {...props} timeRange={{ from, to, raw: { from, to } }} />);
  expect(await screen.findByText(pattern)).toBeInTheDocument();
  expect(unsubscribed).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle row expanded' }));
  expect(await screen.findByText('This pattern returns no logs.')).toBeInTheDocument();
  expect(query.mock.calls[1]?.[0].range).toMatchObject({ from, to });
});

it('assigns distinct theme palette colors to each pattern before rendering', async () => {
  const getResource = setup();
  getResource.mockResolvedValue({
    data: [...response.data, { pattern: 'worker <_> ready', level: 'info', samples: [[1, 3]] }],
  });
  const frames = await getEmbededPatterns(
    props.datasourceUid,
    props.query,
    props.timeRange,
    new AbortController().signal
  );
  const colors = frames.map(
    ({ dataFrame }) => dataFrame.fields.find((field) => field.type === FieldType.number)?.config.color
  );
  expect(colors).toEqual([
    { mode: 'fixed', fixedColor: config.theme2.visualization.palette[0] },
    { mode: 'fixed', fixedColor: config.theme2.visualization.palette[1] },
  ]);
});

it('uses the native table columns and count sorting in wide containers', async () => {
  const getResource = setup();
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1200, 600));
  getResource.mockResolvedValue({
    data: [...response.data, { pattern: 'worker <_> ready', level: 'info', samples: [[1, 3]] }],
  });
  render(<Patterns {...props} />);
  await screen.findByText(pattern);
  expect(screen.getByRole('columnheader', { name: 'Levels' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sort column Count' }));
  expect(screen.getAllByTestId(testIds.exposedComponents.patterns.card).map((cell) => cell.textContent)).toEqual([
    'worker <_> ready',
    pattern,
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Sort column Count' }));
  expect(screen.getAllByTestId(testIds.exposedComponents.patterns.card).map((cell) => cell.textContent)).toEqual([
    pattern,
    'worker <_> ready',
  ]);
});
