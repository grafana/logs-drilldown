import React, { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { of } from 'rxjs';

import { AppPluginMeta, GrafanaPlugin, PluginConfigPage, PluginMeta, PluginType } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';

import { getDefaultDatasourceFromDatasourceSrv, getLastUsedDataSourceFromStorage } from '../../services/store';
import AppConfig, { updatePlugin, type JsonData } from './AppConfig';

jest.mock('Components/FeatureFlagContext', () => ({
  FeatureFlagContext: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  locationService: {
    reload: jest.fn(),
    getLocation: jest.fn(),
  },
  DataSourcePicker: function MockDataSourcePicker({
    current,
    onChange,
  }: {
    current: string;
    onChange: (ds: { uid: string }) => void;
  }) {
    return (
      <div data-testid="data-testid ac-datasource-input">
        <select value={current} onChange={(e) => onChange({ uid: e.target.value })} aria-label="Default data source">
          <option value="">Select</option>
          <option value="loki-uid">Loki</option>
        </select>
      </div>
    );
  },
}));

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  getTimeZone: jest.fn(() => 'utc'),
}));

jest.mock('../../services/store', () => ({
  getDefaultDatasourceFromDatasourceSrv: jest.fn(),
  getLastUsedDataSourceFromStorage: jest.fn(),
}));

jest.mock('../../services/logger', () => ({
  logger: { error: jest.fn() },
}));

const mockGetBackendSrv = jest.mocked(getBackendSrv);
const mockLocationServiceReload = jest.mocked(locationService.reload);
const mockGetDefaultDatasource = jest.mocked(getDefaultDatasourceFromDatasourceSrv);
const mockGetLastUsedDataSource = jest.mocked(getLastUsedDataSourceFromStorage);

function createPluginMeta(
  overrides?: Partial<GrafanaPlugin<AppPluginMeta<JsonData>>>
): GrafanaPlugin<AppPluginMeta<JsonData>> {
  return {
    meta: {
      id: 'grafana-lokiexplore-app',
      type: PluginType.app,
      name: 'Logs Drilldown',
      info: {} as PluginMeta['info'],
      module: '',
      baseUrl: '',
      enabled: true,
      pinned: false,
      jsonData: {},
      ...overrides?.meta,
    },
    addConfigPage: function (tab: PluginConfigPage<AppPluginMeta<JsonData>>): GrafanaPlugin<AppPluginMeta<JsonData>> {
      throw new Error('Function not implemented.');
    },
    setChannelSupport: function (): GrafanaPlugin<AppPluginMeta<JsonData>> {
      throw new Error('Function not implemented.');
    },
    ...overrides,
  };
}

function renderAppConfig(plugin = createPluginMeta()) {
  return render(<AppConfig plugin={plugin} query={{}} />);
}

/** Interval input is the first input with placeholder "7d" (patterns checkbox incorrectly shares it in the component). */
function getIntervalInput() {
  return screen.getAllByPlaceholderText('7d')[0];
}

describe('AppConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDefaultDatasource.mockReturnValue(undefined);
    mockGetLastUsedDataSource.mockReturnValue(undefined);
    mockGetBackendSrv.mockReturnValue({
      fetch: jest.fn().mockReturnValue(of({ data: {} })),
    } as any);
  });

  describe('render', () => {
    it('renders settings section with default data source field', () => {
      renderAppConfig();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByLabelText('Default data source')).toBeInTheDocument();
    });

    it('renders maximum time picker interval input', () => {
      renderAppConfig();
      expect(screen.getByText('Maximum time picker interval')).toBeInTheDocument();
      expect(getIntervalInput()).toBeInTheDocument();
    });

    it('renders default time range checkbox', () => {
      renderAppConfig();
      expect(screen.getByLabelText('Use custom default time range')).toBeInTheDocument();
    });

    it('renders Disable patterns checkbox', () => {
      renderAppConfig();
      expect(screen.getByLabelText('Disable patterns')).toBeInTheDocument();
    });

    it('renders Save settings button', () => {
      renderAppConfig();
      expect(screen.getByRole('button', { name: 'Save settings' })).toBeInTheDocument();
    });

    it('initializes data source from jsonData when provided', () => {
      const plugin = createPluginMeta({
        meta: {
          ...createPluginMeta().meta,
          jsonData: { dataSource: 'saved-ds-uid' },
        } as any,
      });
      mockGetDefaultDatasource.mockReturnValue(undefined);
      renderAppConfig(plugin);
      const select = screen.getByLabelText('Default data source');
      expect(select).toHaveValue('');
      // DataSourcePicker is mocked with options "" and "loki-uid"; jsonData sets state but mock only has those options
      expect(screen.getByTestId('data-testid ac-datasource-input')).toBeInTheDocument();
    });

    it('initializes interval from jsonData when provided', () => {
      const plugin = createPluginMeta({
        meta: {
          ...createPluginMeta().meta,
          jsonData: { interval: '24h' },
        } as any,
      });
      renderAppConfig(plugin);
      expect(getIntervalInput()).toHaveValue('24h');
    });
  });

  describe('interval validation', () => {
    it('disables Save when interval is invalid (less than 1 hour)', () => {
      renderAppConfig();
      const intervalInput = getIntervalInput();
      fireEvent.change(intervalInput, { target: { value: '30m' } });
      expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    });

    it('enables Save when interval is valid', () => {
      renderAppConfig();
      const intervalInput = getIntervalInput();
      fireEvent.change(intervalInput, { target: { value: '2h' } });
      expect(screen.getByRole('button', { name: 'Save settings' })).not.toBeDisabled();
    });

    it('enables Save when interval is empty', () => {
      renderAppConfig();
      const intervalInput = getIntervalInput();
      expect(intervalInput).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Save settings' })).not.toBeDisabled();
    });
  });

  describe('default time range', () => {
    it('shows From/To inputs when default time range is enabled', () => {
      renderAppConfig();
      expect(screen.queryByTestId('data-testid ac-default-time-range-from')).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Use custom default time range'));
      expect(screen.getByTestId('data-testid ac-default-time-range-from')).toBeInTheDocument();
      expect(screen.getByTestId('data-testid ac-default-time-range-to')).toBeInTheDocument();
    });

    it('disables Save when default time range is enabled and invalid (To before From)', () => {
      renderAppConfig();
      fireEvent.click(screen.getByLabelText('Use custom default time range'));
      const fromInput = screen.getByTestId('data-testid ac-default-time-range-from');
      const toInput = screen.getByTestId('data-testid ac-default-time-range-to');
      fireEvent.change(fromInput, { target: { value: 'now' } });
      fireEvent.change(toInput, { target: { value: 'now-1h' } });
      expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    });

    it('disables Save when the time range is not valid', () => {
      renderAppConfig();
      fireEvent.click(screen.getByLabelText('Use custom default time range'));
      const fromInput = screen.getByTestId('data-testid ac-default-time-range-from');
      const toInput = screen.getByTestId('data-testid ac-default-time-range-to');
      fireEvent.change(fromInput, { target: { value: 'nope' } });
      fireEvent.change(toInput, { target: { value: 'now-1h' } });
      expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    });
  });

  describe('Save settings', () => {
    it('calls updatePlugin and reloads on Save', async () => {
      const plugin = createPluginMeta();
      renderAppConfig(plugin);
      const saveButton = screen.getByRole('button', { name: 'Save settings' });
      expect(saveButton).not.toBeDisabled();
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockGetBackendSrv().fetch).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/plugins/grafana-lokiexplore-app/settings',
            data: expect.objectContaining({
              jsonData: expect.objectContaining({
                dataSource: '',
                interval: '',
                patternsDisabled: false,
                defaultTimeRange: undefined,
              }),
            }),
          })
        );
      });
      expect(mockLocationServiceReload).toHaveBeenCalled();
    });

    it('includes defaultTimeRange in payload when enabled and valid', async () => {
      const plugin = createPluginMeta();
      renderAppConfig(plugin);
      fireEvent.click(screen.getByLabelText('Use custom default time range'));
      const fromInput = screen.getByTestId('data-testid ac-default-time-range-from');
      const toInput = screen.getByTestId('data-testid ac-default-time-range-to');
      fireEvent.change(fromInput, { target: { value: 'now-1h' } });
      fireEvent.change(toInput, { target: { value: 'now' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

      await Promise.resolve();
      expect(mockGetBackendSrv().fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jsonData: expect.objectContaining({
              defaultTimeRange: { from: 'now-1h', to: 'now' },
            }),
          }),
        })
      );
    });
  });
});

describe('updatePlugin', () => {
  it('POSTs to plugin settings API and returns data', async () => {
    const data = { jsonData: { dataSource: 'ds1' } };
    mockGetBackendSrv.mockReturnValue({
      fetch: jest.fn().mockReturnValue(of({ data: { updated: true } })),
    } as any);

    const result = await updatePlugin('my-plugin', data);

    expect(mockGetBackendSrv().fetch).toHaveBeenCalledWith({
      method: 'POST',
      url: '/api/plugins/my-plugin/settings',
      data,
    });
    expect(result).toEqual({ updated: true });
  });
});
