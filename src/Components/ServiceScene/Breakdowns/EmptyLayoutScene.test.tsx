import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { isAssistantAvailable, openAssistant } from '@grafana/assistant';

import { EmptyLayoutScene } from './EmptyLayoutScene';
import { getEmptyStateOptions } from 'services/extensions/embedding';

// Mock dependencies
jest.mock('@grafana/assistant');
jest.mock('services/extensions/embedding');

const mockIsAssistantAvailable = jest.mocked(isAssistantAvailable);
const mockOpenAssistant = jest.mocked(openAssistant);
const mockGetEmptyStateOptions = jest.mocked(getEmptyStateOptions);

const types: Array<'fields' | 'labels'> = ['labels', 'fields'];

describe('EmptyLayoutScene', () => {
  let scene: EmptyLayoutScene;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEmptyStateOptions.mockReturnValue(undefined);
  });

  describe.each(types)('with type "%s"', (type: 'fields' | 'labels') => {
    beforeEach(() => {
      scene = new EmptyLayoutScene({ type });
    });

    test('renders empty state message for fields', () => {
      mockIsAssistantAvailable.mockReturnValue(of(false));

      render(<scene.Component model={scene} />);

      expect(screen.getByText(new RegExp(`We did not find any ${type} for the given timerange`))).toBeInTheDocument();
    });

    test('does not show assistant button when assistant is not available', () => {
      mockIsAssistantAvailable.mockReturnValue(of(false));

      render(<scene.Component model={scene} />);

      expect(screen.queryByText('Ask Grafana Assistant')).not.toBeInTheDocument();
    });

    test('shows assistant button when assistant is available', async () => {
      mockIsAssistantAvailable.mockReturnValue(of(true));

      render(<scene.Component model={scene} />);

      await waitFor(() => {
        expect(screen.getByText('Ask Grafana Assistant')).toBeInTheDocument();
      });
    });

    test('calls openAssistant with correct parameters when assistant button is clicked', async () => {
      mockIsAssistantAvailable.mockReturnValue(of(true));

      render(<scene.Component model={scene} />);

      const assistantButton = await waitFor(() => screen.getByText('Ask Grafana Assistant'));
      await userEvent.click(assistantButton);

      expect(mockOpenAssistant).toHaveBeenCalledWith({
        origin: 'logs-drilldown-empty-results',
        prompt: `Investigate why there are no ${type} to display with the current filters and time range.`,
      });
    });

    test('uses custom prompt from embedded options when available', async () => {
      const customPrompt = 'Custom investigation prompt for fields';
      mockGetEmptyStateOptions.mockReturnValue({ customPrompt });
      mockIsAssistantAvailable.mockReturnValue(of(true));

      render(<scene.Component model={scene} />);

      const assistantButton = await waitFor(() => screen.getByText('Ask Grafana Assistant'));
      await userEvent.click(assistantButton);

      expect(mockOpenAssistant).toHaveBeenCalledWith({
        origin: 'logs-drilldown-empty-results',
        prompt: customPrompt,
      });
    });

    test('uses custom CTA text from embedded options when available', async () => {
      const customCTA = 'Custom Assistant CTA';
      mockGetEmptyStateOptions.mockReturnValue({ promptCTA: customCTA });
      mockIsAssistantAvailable.mockReturnValue(of(true));

      render(<scene.Component model={scene} />);

      await waitFor(() => {
        expect(screen.getByText(customCTA)).toBeInTheDocument();
      });

      expect(screen.queryByText('Ask Grafana Assistant')).not.toBeInTheDocument();
    });

    test('calls getEmptyStateOptions with correct parameters', () => {
      mockIsAssistantAvailable.mockReturnValue(of(false));

      render(<scene.Component model={scene} />);

      expect(mockGetEmptyStateOptions).toHaveBeenCalledWith(type, scene);
    });
  });
});
