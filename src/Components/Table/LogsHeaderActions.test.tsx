import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { LogsPanelHeaderActions } from './LogsHeaderActions';
import { LineLimitScene } from 'Components/ServiceScene/LineLimitScene';
import { toggleLogsListPanelSize } from 'services/scenes';
import { getExpandedLogsView, setExpandedLogsView } from 'services/store';

jest.mock('services/store', () => {
  const actual = jest.requireActual<typeof import('services/store')>('services/store');
  return {
    ...actual,
    getExpandedLogsView: jest.fn(),
    setExpandedLogsView: jest.fn(),
  };
});

jest.mock('services/scenes', () => {
  const actual = jest.requireActual<typeof import('services/scenes')>('services/scenes');
  return {
    ...actual,
    toggleLogsListPanelSize: jest.fn(),
  };
});

class MockLineLimitScene extends SceneObjectBase<SceneObjectState> {
  public static Component = () => <div data-testid="line-limit-mock">Line limit</div>;
}

describe('LogsPanelHeaderActions', () => {
  const getExpandedLogsViewMock = getExpandedLogsView as jest.MockedFunction<typeof getExpandedLogsView>;
  const setExpandedLogsViewMock = setExpandedLogsView as jest.MockedFunction<typeof setExpandedLogsView>;
  const toggleLogsListPanelSizeMock = toggleLogsListPanelSize as jest.MockedFunction<typeof toggleLogsListPanelSize>;

  beforeEach(() => {
    jest.clearAllMocks();
    getExpandedLogsViewMock.mockReturnValue(false);
  });

  test('renders expand control, visualization radios, and line limit scene', () => {
    const lineLimitScene = new MockLineLimitScene({});
    const onChange = jest.fn();

    render(
      <LogsPanelHeaderActions
        lineLimitScene={lineLimitScene as unknown as LineLimitScene}
        onChange={onChange}
        vizType="logs"
      />
    );

    expect(screen.getByRole('radio', { name: 'Logs' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Table' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'JSON' })).not.toBeChecked();
    expect(screen.getByTestId('line-limit-mock')).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
  });

  test('calls onChange when a different visualization is selected', async () => {
    const user = userEvent.setup();
    const lineLimitScene = new MockLineLimitScene({});
    const onChange = jest.fn();

    render(
      <LogsPanelHeaderActions
        lineLimitScene={lineLimitScene as unknown as LineLimitScene}
        onChange={onChange}
        vizType="logs"
      />
    );

    await user.click(screen.getByRole('radio', { name: 'Table' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('table');
  });

  test('expand control updates stored expanded state and resizes the logs panel', async () => {
    const user = userEvent.setup();
    const lineLimitScene = new MockLineLimitScene({});

    render(
      <LogsPanelHeaderActions
        lineLimitScene={lineLimitScene as unknown as LineLimitScene}
        onChange={jest.fn()}
        vizType="logs"
      />
    );

    const expandButton = screen.getAllByRole('button')[0];
    await user.click(expandButton);

    expect(setExpandedLogsViewMock).toHaveBeenCalledWith(lineLimitScene, true);
    expect(toggleLogsListPanelSizeMock).toHaveBeenCalledWith(lineLimitScene, true);
  });
});
