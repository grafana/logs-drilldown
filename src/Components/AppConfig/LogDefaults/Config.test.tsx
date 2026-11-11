import React, { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { AppPluginMeta, GrafanaPlugin, PluginMeta, PluginType } from '@grafana/data';
import { updateAppPluginSettings } from '@grafana/plugin-compat/apps';

import { JsonData } from '../AppConfig';
import LogDefaultsConfig from './Config';
import { LogDefaults } from 'services/logDefaults';

jest.mock('Components/FeatureFlagContext', () => ({
  FeatureFlagContext: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@grafana/plugin-compat/apps', () => ({
  updateAppPluginSettings: jest.fn(),
}));

const renderConfig = (logDefaults?: LogDefaults) => {
  const plugin: GrafanaPlugin<AppPluginMeta<JsonData>> = {
    meta: {
      id: 'grafana-lokiexplore-app',
      type: PluginType.app,
      name: 'Logs Drilldown',
      info: {} as PluginMeta['info'],
      module: '',
      baseUrl: '',
      enabled: true,
      pinned: true,
      jsonData: { dataSource: 'ds', logDefaults },
    },
    addConfigPage: () => {
      throw new Error('Function not implemented.');
    },
    setChannelSupport: () => {
      throw new Error('Function not implemented.');
    },
  };
  return render(<LogDefaultsConfig plugin={plugin} query={{}} />);
};

const GROUPS = ['Line wrapping', 'Prettify JSON', 'Timestamps', 'Font size', 'Sort order'];
const group = (label: string) => within(screen.getAllByRole('radiogroup')[GROUPS.indexOf(label)]);

const savedJsonData = () => jest.mocked(updateAppPluginSettings).mock.calls[0]?.[1].jsonData as Record<string, unknown>;

describe('LogDefaultsConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves selected defaults and keeps other jsonData', async () => {
    renderConfig();
    fireEvent.click(group('Line wrapping').getByLabelText('Wrap'));
    fireEvent.click(group('Sort order').getByLabelText('Oldest first'));
    fireEvent.click(screen.getByText('Save defaults'));

    await waitFor(() => expect(updateAppPluginSettings).toHaveBeenCalled());
    expect(savedJsonData()).toEqual({
      dataSource: 'ds',
      logDefaults: { wrapLogMessage: true, sortOrder: 'Ascending' },
    });
  });

  it('shows the built-in defaults and saves nothing when they are unchanged', async () => {
    renderConfig();
    expect(group('Line wrapping').getByLabelText('No wrap')).toBeChecked();
    expect(group('Prettify JSON').getByLabelText('Off')).toBeChecked();
    expect(group('Timestamps').getByLabelText('Show')).toBeChecked();
    expect(group('Font size').getByLabelText('Default')).toBeChecked();
    expect(group('Sort order').getByLabelText('Newest first')).toBeChecked();

    fireEvent.click(screen.getByText('Save defaults'));

    await waitFor(() => expect(updateAppPluginSettings).toHaveBeenCalled());
    expect(savedJsonData()).toEqual({ dataSource: 'ds', logDefaults: undefined });
  });

  it('drops a default again when it is set back to the built-in value', async () => {
    renderConfig({ wrapLogMessage: true, showTime: false });
    expect(group('Line wrapping').getByLabelText('Wrap')).toBeChecked();
    expect(group('Timestamps').getByLabelText('Hide')).toBeChecked();

    fireEvent.click(group('Line wrapping').getByLabelText('No wrap'));
    fireEvent.click(screen.getByText('Save defaults'));

    await waitFor(() => expect(updateAppPluginSettings).toHaveBeenCalled());
    expect(savedJsonData().logDefaults).toEqual({ showTime: false });
  });
});
