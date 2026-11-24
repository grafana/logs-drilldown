import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAssistant } from '@grafana/assistant';
import { reportInteraction } from '@grafana/runtime';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { LogsPanelError } from './LogsPanelError';

// Load the SDK's ESM build so the real OpenAssistantButton reads the mocked useAssistant.
jest.mock('@grafana/assistant', () => jest.requireActual('@grafana/assistant/dist/esm/index.js'));
jest.mock('@grafana/assistant/dist/esm/hook', () => ({ useAssistant: jest.fn() }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('@grafana/scenes', () => ({
  sceneGraph: {
    getAncestor: jest.fn(),
  },
}));

jest.mock('Components/IndexScene/IndexScene', () => ({
  IndexScene: {},
}));

const mockUseAssistant = jest.mocked(useAssistant);
const mockOpenAssistant = jest.fn();
const mockGetAncestor = sceneGraph.getAncestor as jest.MockedFunction<typeof sceneGraph.getAncestor>;

const mockAssistantAvailable = (isAvailable: boolean) => {
  mockUseAssistant.mockReturnValue({
    isLoading: false,
    isAvailable,
    openAssistant: isAvailable ? mockOpenAssistant : undefined,
    closeAssistant: undefined,
    toggleAssistant: undefined,
  });
};

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
    mockAssistantAvailable(true);
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

  it('checks assistant availability when errorType is no-logs', () => {
    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(mockUseAssistant).toHaveBeenCalled();
  });

  it('does not check assistant availability when errorType is not no-logs', () => {
    render(<LogsPanelError error="Other error" errorType="other" sceneRef={mockSceneRef} />);

    expect(mockUseAssistant).not.toHaveBeenCalled();
    expect(reportInteraction).not.toHaveBeenCalled();
  });

  it('renders assistant button when errorType is no-logs and assistant is available', () => {
    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(screen.getByRole('button', { name: 'Ask Grafana Assistant' })).toBeInTheDocument();
    expect(reportInteraction).toHaveBeenCalledWith('grafana_assistant_app_open_sidebar_button_displayed', {
      from: 'logs-drilldown-empty-results',
    });
  });

  it('does not render assistant button when assistant is not available', () => {
    mockAssistantAvailable(false);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(screen.queryByRole('button', { name: 'Ask Grafana Assistant' })).not.toBeInTheDocument();
  });

  it('does not render assistant button when errorType is not no-logs', () => {
    render(<LogsPanelError error="Other error" errorType="other" sceneRef={mockSceneRef} />);

    expect(screen.queryByRole('button', { name: 'Ask Grafana Assistant' })).not.toBeInTheDocument();
  });

  it('calls openAssistant with default prompt when assistant button is clicked (non-embedded)', async () => {
    const user = userEvent.setup();

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    await user.click(screen.getByRole('button', { name: 'Ask Grafana Assistant' }));

    expect(mockOpenAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'logs-drilldown-empty-results',
        prompt: 'Investigate why there are no logs to display with the current filters and time range.',
        autoSend: true,
      })
    );
  });

  it('calls openAssistant with custom prompt when assistant button is clicked (embedded)', async () => {
    const user = userEvent.setup();
    mockGetAncestor.mockReturnValue(mockEmbeddedIndexScene);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    await user.click(screen.getByRole('button', { name: 'Custom CTA' }));

    expect(mockOpenAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'logs-drilldown-empty-results',
        prompt: 'Custom embedded prompt',
      })
    );
  });

  it('handles missing indexScene gracefully', async () => {
    const user = userEvent.setup();
    mockGetAncestor.mockReturnValue(null);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    await user.click(screen.getByRole('button', { name: 'Ask Grafana Assistant' }));

    expect(mockOpenAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'logs-drilldown-empty-results',
        prompt: 'Investigate why there are no logs to display with the current filters and time range.',
      })
    );
  });

  it('renders both buttons when both clearFilters and assistant are available', () => {
    render(
      <LogsPanelError
        error="No logs found"
        errorType="no-logs"
        clearFilters={mockClearFilters}
        sceneRef={mockSceneRef}
      />
    );

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask Grafana Assistant' })).toBeInTheDocument();
  });

  it('handles assistant availability changes', () => {
    mockAssistantAvailable(false);

    const { rerender } = render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(screen.queryByRole('button', { name: 'Ask Grafana Assistant' })).not.toBeInTheDocument();

    mockAssistantAvailable(true);
    rerender(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(screen.getByRole('button', { name: 'Ask Grafana Assistant' })).toBeInTheDocument();
  });
});
