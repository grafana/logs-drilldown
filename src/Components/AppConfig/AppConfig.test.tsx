import React, { ReactNode } from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AppPluginMeta, GrafanaPlugin, PluginConfigPage, PluginMeta, PluginType } from '@grafana/data';
import { updateAppPluginSettings } from '@grafana/plugin-compat/apps';
import { locationService } from '@grafana/runtime';

import AppConfig, { updatePlugin, type JsonData } from './AppConfig';
import { getDefaultDatasourceUid, getLastUsedDataSourceFromStorage } from 'services/store';

jest.mock('Components/FeatureFlagContext', () => ({
  FeatureFlagContext: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@grafana/plugin-compat/apps', () => ({
  updateAppPluginSettings: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
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

jest.mock('services/store', () => ({
  getDefaultDatasourceUid: jest.fn(),
  getLastUsedDataSourceFromStorage: jest.fn(),
}));

jest.mock('services/logger', () => ({
  logger: { error: jest.fn() },
}));

const mockUpdateAppPluginSettings = jest.mocked(updateAppPluginSettings);
const mockLocationServiceReload = jest.mocked(locationService.reload);
const mockGetDefaultDatasource = jest.mocked(getDefaultDatasourceUid);
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

// Renders and lets the default datasource lookup settle, so Save reflects only form validity.
async function renderAppConfigResolved(plugin = createPluginMeta()) {
  await act(async () => {
    renderAppConfig(plugin);
  });
}

/** Interval input is the first input with placeholder "7d" (patterns checkbox incorrectly shares it in the component). */
function getIntervalInput() {
  return screen.getAllByPlaceholderText('7d')[0];
}

describe('AppConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDefaultDatasource.mockResolvedValue(undefined);
    mockGetLastUsedDataSource.mockReturnValue(undefined);
    mockUpdateAppPluginSettings.mockResolvedValue({} as PluginMeta);
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
      mockGetDefaultDatasource.mockResolvedValue(undefined);
      renderAppConfig(plugin);
      const select = screen.getByLabelText('Default data source');
      expect(select).toHaveValue('');
      // DataSourcePicker is mocked with options "" and "loki-uid"; jsonData sets state but mock only has those options
      expect(screen.getByTestId('data-testid ac-datasource-input')).toBeInTheDocument();
    });

    it('uses the resolved default data source when none is configured', async () => {
      mockGetDefaultDatasource.mockResolvedValue('loki-uid');
      renderAppConfig();

      await waitFor(() => expect(screen.getByLabelText('Default data source')).toHaveValue('loki-uid'));
    });

    it('falls back to the last used data source when the default cannot be resolved', async () => {
      mockGetDefaultDatasource.mockRejectedValue(new Error('list failed'));
      mockGetLastUsedDataSource.mockReturnValue('loki-uid');
      renderAppConfig();

      await waitFor(() => expect(screen.getByLabelText('Default data source')).toHaveValue('loki-uid'));
    });

    it('does not look up a default data source when one is saved in jsonData', () => {
      const plugin = createPluginMeta({
        meta: {
          ...createPluginMeta().meta,
          jsonData: { dataSource: 'loki-uid' },
        } as any,
      });
      renderAppConfig(plugin);

      expect(mockGetDefaultDatasource).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Default data source')).toHaveValue('loki-uid');
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
    it('disables Save when interval is invalid (less than 1 hour)', async () => {
      await renderAppConfigResolved();
      const intervalInput = getIntervalInput();
      fireEvent.change(intervalInput, { target: { value: '30m' } });
      expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    });

    it('enables Save when interval is valid', async () => {
      await renderAppConfigResolved();
      const intervalInput = getIntervalInput();
      fireEvent.change(intervalInput, { target: { value: '2h' } });
      expect(screen.getByRole('button', { name: 'Save settings' })).not.toBeDisabled();
    });

    it('enables Save when interval is empty', async () => {
      await renderAppConfigResolved();
      const intervalInput = getIntervalInput();
      expect(intervalInput).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Save settings' })).not.toBeDisabled();
    });
  });

  describe('default time range', () => {
    it('shows From/To inputs when default time range is enabled', async () => {
      await renderAppConfigResolved();
      expect(screen.queryByTestId('data-testid ac-default-time-range-from')).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Use custom default time range'));
      expect(screen.getByTestId('data-testid ac-default-time-range-from')).toBeInTheDocument();
      expect(screen.getByTestId('data-testid ac-default-time-range-to')).toBeInTheDocument();
    });

    it('disables Save when default time range is enabled and invalid (To before From)', async () => {
      await renderAppConfigResolved();
      fireEvent.click(screen.getByLabelText('Use custom default time range'));
      const fromInput = screen.getByTestId('data-testid ac-default-time-range-from');
      const toInput = screen.getByTestId('data-testid ac-default-time-range-to');
      fireEvent.change(fromInput, { target: { value: 'now' } });
      fireEvent.change(toInput, { target: { value: 'now-1h' } });
      expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    });

    it('disables Save when the time range is not valid', async () => {
      await renderAppConfigResolved();
      fireEvent.click(screen.getByLabelText('Use custom default time range'));
      const fromInput = screen.getByTestId('data-testid ac-default-time-range-from');
      const toInput = screen.getByTestId('data-testid ac-default-time-range-to');
      fireEvent.change(fromInput, { target: { value: 'nope' } });
      fireEvent.change(toInput, { target: { value: 'now-1h' } });
      expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    });
  });

  describe('Save settings', () => {
    it('keeps Save disabled until the default data source has resolved', async () => {
      let resolveDefault: (uid: string | undefined) => void = () => {};
      mockGetDefaultDatasource.mockReturnValue(
        new Promise<string | undefined>((resolve) => {
          resolveDefault = resolve;
        })
      );
      renderAppConfig();

      expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();

      await act(async () => {
        resolveDefault('loki-uid');
      });

      expect(screen.getByRole('button', { name: 'Save settings' })).not.toBeDisabled();
    });

    it('calls updatePlugin and reloads on Save', async () => {
      const plugin = createPluginMeta();
      await renderAppConfigResolved(plugin);
      const saveButton = screen.getByRole('button', { name: 'Save settings' });
      expect(saveButton).not.toBeDisabled();
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateAppPluginSettings).toHaveBeenCalledWith(
          'grafana-lokiexplore-app',
          expect.objectContaining({
            jsonData: expect.objectContaining({
              dataSource: '',
              interval: '',
              patternsDisabled: false,
              defaultTimeRange: undefined,
            }),
          })
        );
      });
      expect(mockLocationServiceReload).toHaveBeenCalled();
    });

    it('includes defaultTimeRange in payload when enabled and valid', async () => {
      const plugin = createPluginMeta();
      await renderAppConfigResolved(plugin);
      fireEvent.click(screen.getByLabelText('Use custom default time range'));
      const fromInput = screen.getByTestId('data-testid ac-default-time-range-from');
      const toInput = screen.getByTestId('data-testid ac-default-time-range-to');
      fireEvent.change(fromInput, { target: { value: 'now-1h' } });
      fireEvent.change(toInput, { target: { value: 'now' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

      await Promise.resolve();
      expect(mockUpdateAppPluginSettings).toHaveBeenCalledWith(
        'grafana-lokiexplore-app',
        expect.objectContaining({
          jsonData: expect.objectContaining({
            defaultTimeRange: { from: 'now-1h', to: 'now' },
          }),
        })
      );
    });
  });
});

describe('updatePlugin', () => {
  it('updates the plugin settings through plugin-compat and returns the result', async () => {
    const data = { jsonData: { dataSource: 'ds1' } };
    const updated = { id: 'my-plugin' } as PluginMeta;
    mockUpdateAppPluginSettings.mockResolvedValue(updated);

    const result = await updatePlugin('my-plugin', data);

    expect(mockUpdateAppPluginSettings).toHaveBeenCalledWith('my-plugin', data);
    expect(result).toBe(updated);
  });
});
