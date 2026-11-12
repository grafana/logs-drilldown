import React from 'react';

import { act, render, waitFor } from '@testing-library/react';

import { dateTime, toDataFrame } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';

import { Logs } from './Logs';
import { getPatternLogs } from 'services/patterns';

jest.mock('services/patterns', () => ({ getPatternLogs: jest.fn() }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelRenderer: jest.fn(() => null),
}));

it('sizes the logs to the content box and updates the panel when its container resizes', async () => {
  const from = dateTime(1000);
  const to = dateTime(2000);
  jest.mocked(getPatternLogs).mockResolvedValue({
    series: [toDataFrame({ fields: [{ name: 'Line', values: ['request failed'] }] })],
    filtersOmitted: false,
  });
  const clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(316);
  let resize: ResizeObserverCallback = () => {};
  const observer = { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
  global.ResizeObserver = jest.fn().mockImplementation((callback) => {
    resize = callback;
    return observer;
  });
  const view = render(
    <Logs datasourceUid="loki" query='{app="api"}' pattern="request <_>" timeRange={{ from, to, raw: { from, to } }} />
  );

  function resizePanel(width: number) {
    act(() =>
      resize(
        [
          {
            target: document.createElement('div'),
            contentRect: new DOMRect(0, 0, width, 300),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        observer
      )
    );
  }

  resizePanel(300);
  await waitFor(() =>
    expect(jest.mocked(PanelRenderer).mock.lastCall?.[0]).toMatchObject({ pluginId: 'logs', width: 300 })
  );
  resizePanel(200);
  expect(jest.mocked(PanelRenderer).mock.lastCall?.[0]).toMatchObject({ width: 200 });
  expect(getPatternLogs).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
  clientWidth.mockRestore();
});
