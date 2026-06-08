import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { LogsPanelHeaderActions } from './LogsHeaderActions';
import { LineLimitScene } from 'Components/ServiceScene/LineLimitScene';

class MockLineLimitScene extends SceneObjectBase<SceneObjectState> {
  public static Component = () => <div data-testid="line-limit-mock">Line limit</div>;
}

describe('LogsPanelHeaderActions', () => {
  test('renders visualization radios, and line limit scene', () => {
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
});
