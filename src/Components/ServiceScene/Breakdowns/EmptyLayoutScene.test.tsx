import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAssistant } from '@grafana/assistant';
import { reportInteraction } from '@grafana/runtime';

import { EmptyLayoutScene } from './EmptyLayoutScene';
import { getEmptyStateOptions } from 'services/extensions/embedding';

// Load the SDK's ESM build so the real OpenAssistantButton reads the mocked useAssistant.
jest.mock('@grafana/assistant', () => jest.requireActual('@grafana/assistant/dist/esm/index.js'));
jest.mock('@grafana/assistant/dist/esm/hook', () => ({ useAssistant: jest.fn() }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));
jest.mock('services/extensions/embedding');

const mockUseAssistant = jest.mocked(useAssistant);
const mockOpenAssistant = jest.fn();
const mockGetEmptyStateOptions = jest.mocked(getEmptyStateOptions);

const mockAssistantAvailable = (isAvailable: boolean) => {
  mockUseAssistant.mockReturnValue({
    isLoading: false,
    isAvailable,
    openAssistant: isAvailable ? mockOpenAssistant : undefined,
    closeAssistant: undefined,
    toggleAssistant: undefined,
  });
};

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
      mockAssistantAvailable(false);

      render(<scene.Component model={scene} />);

      expect(screen.getByText(new RegExp(`We did not find any ${type} for the given time range`))).toBeInTheDocument();
    });

    test('does not show assistant button when assistant is not available', () => {
      mockAssistantAvailable(false);

      render(<scene.Component model={scene} />);

      expect(screen.queryByRole('button', { name: 'Ask Grafana Assistant' })).not.toBeInTheDocument();
    });

    test('shows assistant button when assistant is available', () => {
      mockAssistantAvailable(true);

      render(<scene.Component model={scene} />);

      expect(screen.getByRole('button', { name: 'Ask Grafana Assistant' })).toBeInTheDocument();
      expect(reportInteraction).toHaveBeenCalledWith('grafana_assistant_app_open_sidebar_button_displayed', {
        from: 'logs-drilldown-empty-results',
      });
    });

    test('calls openAssistant with correct parameters when assistant button is clicked', async () => {
      mockAssistantAvailable(true);

      render(<scene.Component model={scene} />);

      await userEvent.click(screen.getByRole('button', { name: 'Ask Grafana Assistant' }));

      expect(mockOpenAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'logs-drilldown-empty-results',
          prompt: `Investigate why there are no ${type} to display with the current filters and time range.`,
          autoSend: true,
        })
      );
    });

    test('uses custom prompt from embedded options when available', async () => {
      const customPrompt = 'Custom investigation prompt for fields';
      mockGetEmptyStateOptions.mockReturnValue({ customPrompt });
      mockAssistantAvailable(true);

      render(<scene.Component model={scene} />);

      await userEvent.click(screen.getByRole('button', { name: 'Ask Grafana Assistant' }));

      expect(mockOpenAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'logs-drilldown-empty-results',
          prompt: customPrompt,
        })
      );
    });

    test('uses custom CTA text from embedded options when available', () => {
      const customCTA = 'Custom Assistant CTA';
      mockGetEmptyStateOptions.mockReturnValue({ promptCTA: customCTA });
      mockAssistantAvailable(true);

      render(<scene.Component model={scene} />);

      expect(screen.getByRole('button', { name: customCTA })).toBeInTheDocument();
      expect(screen.queryByText('Ask Grafana Assistant')).not.toBeInTheDocument();
    });

    test('calls getEmptyStateOptions with correct parameters', () => {
      mockAssistantAvailable(false);

      render(<scene.Component model={scene} />);

      expect(mockGetEmptyStateOptions).toHaveBeenCalledWith(type, scene);
    });
  });
});
