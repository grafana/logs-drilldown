import { config } from '@grafana/runtime';

import { plugin } from '../module';
import { getQuickOptions, getQuickRanges } from './timePicker';

jest.mock('../module', () => ({ plugin: { meta: { jsonData: {} } } }));

const setDefaultRange = (defaultTimeRange?: { from: string; to: string }) => {
  (plugin.meta as { jsonData?: object }).jsonData = { defaultTimeRange };
};

describe('getQuickRanges', () => {
  const original = config.quickRanges;

  afterEach(() => {
    config.quickRanges = original;
    setDefaultRange(undefined);
  });

  it.each([undefined, []])('falls back to the built-in ranges when the server config is %p', (value) => {
    config.quickRanges = value;
    expect(getQuickRanges()).toEqual(getQuickOptions());
  });

  it('uses the server ranges and drops malformed entries', () => {
    config.quickRanges = [
      { from: 'now-6s', to: 'now', display: 'Last 6 seconds' },
      { from: 'garbage', to: 'now', display: 'Bad' },
      { from: 'now-1h', to: 'now', display: '' },
    ];
    expect(getQuickRanges()).toEqual([{ from: 'now-6s', to: 'now', display: 'Last 6 seconds' }]);
  });

  it('pins the app-config default range first when the server list lacks it', () => {
    config.quickRanges = [{ from: 'now-10m', to: 'now', display: 'Last 10 minutes' }];
    setDefaultRange({ from: 'now-3h', to: 'now' });

    const ranges = getQuickRanges();
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toMatchObject({ from: 'now-3h', to: 'now' });
    expect(ranges[0]?.display).toBeTruthy();
  });

  it('does not duplicate the default range when the server list already has it', () => {
    config.quickRanges = [{ from: 'now-3h', to: 'now', display: 'Three hours' }];
    setDefaultRange({ from: 'now-3h', to: 'now' });

    expect(getQuickRanges()).toEqual([{ from: 'now-3h', to: 'now', display: 'Three hours' }]);
  });

  it('does not touch the built-in ranges when only the app-config default is set', () => {
    setDefaultRange({ from: 'now-3h', to: 'now' });
    expect(getQuickRanges()).toEqual(getQuickOptions());
  });
});
