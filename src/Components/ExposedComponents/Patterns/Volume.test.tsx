import React from 'react';

import { act, render } from '@testing-library/react';

import { dateTime, FieldType, toDataFrame } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';

import { Volume } from './Volume';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelRenderer: jest.fn(() => null),
}));

const from = dateTime(1000);
const to = dateTime(2000);
const range = { from, to, raw: { from, to } };
const dataFrame = toDataFrame({
  name: 'request <_>',
  fields: [
    { name: 'Time', type: FieldType.time, values: [1000, 2000] },
    {
      name: 'request <_>',
      type: FieldType.number,
      values: [3, 7],
      config: { color: { mode: 'fixed', fixedColor: 'yellow' } },
    },
  ],
});
const patterns = [{ pattern: 'request <_>', sum: 10, levels: ['info'], dataFrame }];

it('resizes the native panel and forwards zoom to the latest host callback', () => {
  let resize: ResizeObserverCallback = () => {};
  const observer = { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
  global.ResizeObserver = jest.fn().mockImplementation((callback) => {
    resize = callback;
    return observer;
  });
  const oldCallback = jest.fn();
  const callback = jest.fn();
  const url = location.href;
  const view = render(<Volume patterns={patterns} range={range} onTimeRangeChange={oldCallback} />);

  function resizePanel(width: number) {
    act(() =>
      resize(
        [
          {
            target: document.createElement('div'),
            contentRect: new DOMRect(0, 0, width, 240),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        observer
      )
    );
  }

  resizePanel(900);
  expect(jest.mocked(PanelRenderer).mock.lastCall?.[0]).toMatchObject({
    pluginId: 'timeseries',
    width: 900,
    height: 240,
    options: { legend: { placement: 'right' } },
    data: {
      timeRange: range,
      series: [
        { fields: [{ name: 'Time' }, { name: '', values: [3, 7], config: { color: { fixedColor: 'yellow' } } }] },
      ],
    },
  });
  expect(dataFrame.fields[1]?.name).toBe('request <_>');
  view.rerender(<Volume patterns={patterns} range={range} onTimeRangeChange={callback} />);
  resizePanel(340);
  const props = jest.mocked(PanelRenderer).mock.lastCall?.[0];
  expect(props).toMatchObject({ width: 340, options: { legend: { placement: 'bottom' } } });
  props?.onChangeTimeRange?.({ from: 1200, to: 1800 });
  expect(oldCallback).not.toHaveBeenCalled();
  expect(callback.mock.calls[0]?.[0].from.valueOf()).toBe(1200);
  expect(callback.mock.calls[0]?.[0].to.valueOf()).toBe(1800);
  expect(location.href).toBe(url);
  view.unmount();
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});
