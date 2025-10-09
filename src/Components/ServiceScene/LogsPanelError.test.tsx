import React from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, of } from 'rxjs';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { LogsPanelError } from './LogsPanelError';

jest.mock('@grafana/assistant', () => ({
  isAssistantAvailable: jest.fn(),
  openAssistant: jest.fn(),
}));

jest.mock('@grafana/scenes', () => ({
  sceneGraph: {
    getAncestor: jest.fn(),
  },
}));

jest.mock('Components/IndexScene/IndexScene', () => ({
  IndexScene: {},
}));

const mockIsAssistantAvailable = isAssistantAvailable as jest.MockedFunction<typeof isAssistantAvailable>;
const mockOpenAssistant = openAssistant as jest.MockedFunction<typeof openAssistant>;
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

  it('checks assistant availability when errorType is no-logs', async () => {
    const assistantSubject = new BehaviorSubject(true);
    mockIsAssistantAvailable.mockReturnValue(assistantSubject);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(mockIsAssistantAvailable).toHaveBeenCalledTimes(1);
  });

  it('does not check assistant availability when errorType is not no-logs', () => {
    render(<LogsPanelError error="Other error" errorType="other" sceneRef={mockSceneRef} />);

    expect(mockIsAssistantAvailable).not.toHaveBeenCalled();
  });

  it('renders assistant button when errorType is no-logs and assistant is available', async () => {
    mockIsAssistantAvailable.mockReturnValue(of(true));

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    await waitFor(() => expect(mockIsAssistantAvailable).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByText('Ask Grafana Assistant')).toBeInTheDocument());
  });

  it('does not render assistant button when assistant is not available', async () => {
    const assistantSubject = new BehaviorSubject(false);
    mockIsAssistantAvailable.mockReturnValue(assistantSubject);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(screen.queryByText('Ask Grafana Assistant')).not.toBeInTheDocument();
  });

  it('does not render assistant button when errorType is not no-logs', () => {
    render(<LogsPanelError error="Other error" errorType="other" sceneRef={mockSceneRef} />);

    expect(screen.queryByText('Ask Grafana Assistant')).not.toBeInTheDocument();
  });

  it('calls openAssistant with default prompt when assistant button is clicked (non-embedded)', async () => {
    const user = userEvent.setup();
    mockIsAssistantAvailable.mockReturnValue(of(true));

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(screen.getByText('Ask Grafana Assistant')).toBeInTheDocument();

    await user.click(screen.getByText('Ask Grafana Assistant'));

    expect(mockOpenAssistant).toHaveBeenCalledWith({
      origin: 'logs-drilldown-empty-results',
      prompt: 'Investigate why there are no logs to display with the current filters and time range.',
    });
  });

  it('calls openAssistant with custom prompt when assistant button is clicked (embedded)', async () => {
    const user = userEvent.setup();
    mockIsAssistantAvailable.mockReturnValue(of(true));

    mockGetAncestor.mockReturnValue(mockEmbeddedIndexScene);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(screen.getByText('Custom CTA')).toBeInTheDocument();

    await user.click(screen.getByText('Custom CTA'));

    expect(mockOpenAssistant).toHaveBeenCalledWith({
      origin: 'logs-drilldown-empty-results',
      prompt: 'Custom embedded prompt',
    });
  });

  it('handles missing indexScene gracefully', async () => {
    const user = userEvent.setup();
    const assistantSubject = new BehaviorSubject(true);
    mockIsAssistantAvailable.mockReturnValue(assistantSubject);
    mockGetAncestor.mockReturnValue(null);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(screen.getByText('Ask Grafana Assistant')).toBeInTheDocument();

    await user.click(screen.getByText('Ask Grafana Assistant'));

    expect(mockOpenAssistant).toHaveBeenCalledWith({
      origin: 'logs-drilldown-empty-results',
      prompt: 'Investigate why there are no logs to display with the current filters and time range.',
    });
  });

  it('renders both buttons when both clearFilters and assistant are available', async () => {
    const assistantSubject = new BehaviorSubject(true);
    mockIsAssistantAvailable.mockReturnValue(assistantSubject);

    render(
      <LogsPanelError
        error="No logs found"
        errorType="no-logs"
        clearFilters={mockClearFilters}
        sceneRef={mockSceneRef}
      />
    );

    expect(screen.getByText('Clear filters')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Ask Grafana Assistant')).toBeInTheDocument();
    });
  });

  it('handles assistant availability changes', async () => {
    const assistantSubject = new BehaviorSubject(false);
    mockIsAssistantAvailable.mockReturnValue(assistantSubject);

    render(<LogsPanelError error="No logs found" errorType="no-logs" sceneRef={mockSceneRef} />);

    expect(screen.queryByText('Ask Grafana Assistant')).not.toBeInTheDocument();

    // Simulate assistant becoming available
    act(() => {
      assistantSubject.next(true);
    });

    await waitFor(() => {
      expect(screen.getByText('Ask Grafana Assistant')).toBeInTheDocument();
    });
  });
});
