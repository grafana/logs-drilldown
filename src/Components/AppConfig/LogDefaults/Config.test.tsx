import React, { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { updateAppPluginSettings } from '@grafana/plugin-compat/apps';

import LogDefaultsConfig from './Config';

jest.mock('Components/FeatureFlagContext', () => ({
  FeatureFlagContext: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@grafana/plugin-compat/apps', () => ({
  updateAppPluginSettings: jest.fn(),
}));

const renderConfig = (logDefaults?: object) =>
  render(
    <LogDefaultsConfig
      plugin={
        { meta: { id: 'app', enabled: true, pinned: true, jsonData: { dataSource: 'ds', logDefaults } } } as never
      }
      query={{}}
    />
  );

const GROUPS = ['Line wrapping', 'Timestamps', 'Font size', 'Sort order'];
const group = (label: string) => within(screen.getAllByRole('radiogroup')[GROUPS.indexOf(label)] as HTMLElement);

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

  it('clears a default when Not set is selected', async () => {
    renderConfig({ wrapLogMessage: true, showTime: false });
    expect(group('Line wrapping').getByLabelText('Wrap')).toBeChecked();

    fireEvent.click(group('Line wrapping').getByLabelText('Not set'));
    expect(group('Line wrapping').getByLabelText('Not set')).toBeChecked();
    fireEvent.click(screen.getByText('Save defaults'));

    await waitFor(() => expect(updateAppPluginSettings).toHaveBeenCalled());
    expect(savedJsonData().logDefaults).toEqual({ showTime: false });
  });
});
