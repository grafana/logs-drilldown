import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OpenAssistantButton } from '@grafana/assistant';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { LogsPanelError } from './LogsPanelError';

jest.mock('@grafana/assistant', () => ({ OpenAssistantButton: jest.fn(() => null) }));

jest.mock('@grafana/scenes', () => ({
  sceneGraph: {
    getAncestor: jest.fn(),
  },
}));

jest.mock('Components/IndexScene/IndexScene', () => ({
  IndexScene: {},
}));

const mockOpenAssistantButton = jest.mocked(OpenAssistantButton);
const mockGetAncestor = sceneGraph.getAncestor as jest.MockedFunction<typeof sceneGraph.getAncestor>;

describe('LogsPanelError', () => {
  const mockSceneRef = {} as SceneObject;
  const mockClearFilters = jest.fn();
  const mockIndexScene = {
    state: {
      embedded: false,
    },
  };
  const mockEmbeddedIndexScene = {
    state: {
      embedded: true,
      embeddedOptions: {
        emptyStates: {
          logs: {
            customPrompt: 'Custom embedded prompt',
            promptCTA: 'Custom CTA',
          },
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAncestor.mockReturnValue(mockIndexScene);
  });

  it('renders the error message', () => {
    const errorMessage = 'Test error message';

    render(<LogsPanelError error={errorMessage} sceneRef={mockSceneRef} />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('renders clear filters button when clearFilters prop is provided', () => {
    render(<LogsPanelError error="Test error" clearFilters={mockClearFilters} sceneRef={mockSceneRef} />);

    const clearButton = screen.getByText('Clear filters');
    expect(clearButton).toBeInTheDocument();
  });

  it('does not render clear filters button when clearFilters prop is not provided', () => {
    render(<LogsPanelError error="Test error" sceneRef={mockSceneRef} />);

    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
  });

  it('calls clearFilters when clear filters button is clicked', async () => {
    const user = userEvent.setup();

    render(<LogsPanelError error="Test error" clearFilters={mockClearFilters} sceneRef={mockSceneRef} />);

    await user.click(screen.getByText('Clear filters'));
    expect(mockClearFilters).toHaveBeenCalledTimes(1);
  });

  it('renders the assistant button with the default prompt and title when errorType is no-logs', () => {
    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(mockOpenAssistantButton.mock.calls[0]?.[0]).toMatchObject({
      origin: 'logs-drilldown-empty-results',
      prompt: 'Investigate why there are no logs to display with the current filters and time range.',
      title: 'Ask Grafana Assistant',
      size: 'md',
    });
  });

  it('does not render the assistant button when errorType is not no-logs', () => {
    render(<LogsPanelError error="Other error" errorType="other" sceneRef={mockSceneRef} />);

    expect(mockOpenAssistantButton).not.toHaveBeenCalled();
  });

  it('does not render the assistant button when errorType is not set', () => {
    render(<LogsPanelError error="Other error" sceneRef={mockSceneRef} />);

    expect(mockOpenAssistantButton).not.toHaveBeenCalled();
  });

  it('uses the custom prompt and title from embedded options', () => {
    mockGetAncestor.mockReturnValue(mockEmbeddedIndexScene);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(mockOpenAssistantButton.mock.calls[0]?.[0]).toMatchObject({
      origin: 'logs-drilldown-empty-results',
      prompt: 'Custom embedded prompt',
      title: 'Custom CTA',
    });
  });

  it('handles missing indexScene gracefully', () => {
    mockGetAncestor.mockReturnValue(null);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(mockOpenAssistantButton.mock.calls[0]?.[0]).toMatchObject({
      origin: 'logs-drilldown-empty-results',
      prompt: 'Investigate why there are no logs to display with the current filters and time range.',
      title: 'Ask Grafana Assistant',
    });
  });

  it('renders both buttons when clearFilters is provided and errorType is no-logs', () => {
    render(
      <LogsPanelError
        error="No logs found"
        errorType="no-logs"
        clearFilters={mockClearFilters}
        sceneRef={mockSceneRef}
      />
    );

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
    expect(mockOpenAssistantButton).toHaveBeenCalled();
  });
});
