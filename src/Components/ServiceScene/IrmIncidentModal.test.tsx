import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { usePluginComponent } from '@grafana/runtime';

import { IrmIncidentModal } from './IrmIncidentModal';
import { IrmAction } from 'Components/Panels/PanelMenu';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

const context: IrmAction['context'] = {
  url: 'https://example.grafana.net/a/grafana-lokiexplore-app/explore?from=123&to=456',
  caption: 'Logs Drilldown investigation',
};

function mockComponents(available: 'attach' | 'both' | 'none', isLoading = false) {
  jest.mocked(usePluginComponent).mockImplementation((id) => ({
    isLoading,
    component:
      available === 'none' || (available === 'attach' && id.includes('declare'))
        ? null
        : (props: { attachCaption?: string; attachURL?: string; defaultCaption?: string; onDismiss?: () => void }) => (
            <div
              role={id.includes('declare') ? 'dialog' : undefined}
              aria-label={id.includes('declare') ? 'Declare form' : undefined}
            >
              <span>{props.attachURL}</span>
              <span>{props.defaultCaption ?? props.attachCaption}</span>
              <button onClick={props.onDismiss}>Cancel</button>
            </div>
          ),
  }));
}

describe('IRM incident modal', () => {
  it.each(['attach', 'declare'] as const)('hides the %s form when its component is unavailable', (type) => {
    mockComponents('none');
    render(<IrmIncidentModal data={{ type, context }} onDismiss={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['attach', 'declare'] as const)('hides the %s form while loading', (type) => {
    mockComponents('both', true);
    render(<IrmIncidentModal data={{ type, context }} onDismiss={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    ['attach', 'Attach to incident'],
    ['declare', 'Declare form'],
  ] as const)('renders the %s form with the investigation context', (type, form) => {
    mockComponents('both');
    const onDismiss = jest.fn();
    render(<IrmIncidentModal data={{ type, context }} onDismiss={onDismiss} />);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: form })).toHaveTextContent(context.url);
    expect(screen.getByRole('dialog', { name: form })).toHaveTextContent(context.caption);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
