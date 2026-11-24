import React from 'react';

import { render, screen } from '@testing-library/react';

import { OpenAssistantButton } from '@grafana/assistant';

import { EmptyLayoutScene } from './EmptyLayoutScene';
import { getEmptyStateOptions } from 'services/extensions/embedding';

// Mock dependencies
jest.mock('@grafana/assistant', () => ({ OpenAssistantButton: jest.fn(() => null) }));
jest.mock('services/extensions/embedding');

const mockOpenAssistantButton = jest.mocked(OpenAssistantButton);
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
      render(<scene.Component model={scene} />);

      expect(screen.getByText(new RegExp(`We did not find any ${type} for the given time range`))).toBeInTheDocument();
    });

    test('renders the assistant button with the default prompt and title', () => {
      render(<scene.Component model={scene} />);

      expect(mockOpenAssistantButton.mock.calls[0]?.[0]).toMatchObject({
        origin: 'logs-drilldown-empty-results',
        prompt: `Investigate why there are no ${type} to display with the current filters and time range.`,
        title: 'Ask Grafana Assistant',
        size: 'md',
      });
    });

    test('uses custom prompt from embedded options when available', () => {
      const customPrompt = 'Custom investigation prompt for fields';
      mockGetEmptyStateOptions.mockReturnValue({ customPrompt });

      render(<scene.Component model={scene} />);

      expect(mockOpenAssistantButton.mock.calls[0]?.[0]).toMatchObject({
        origin: 'logs-drilldown-empty-results',
        prompt: customPrompt,
      });
    });

    test('uses custom CTA text from embedded options when available', () => {
      const customCTA = 'Custom Assistant CTA';
      mockGetEmptyStateOptions.mockReturnValue({ promptCTA: customCTA });

      render(<scene.Component model={scene} />);

      expect(mockOpenAssistantButton.mock.calls[0]?.[0]).toMatchObject({ title: customCTA });
    });

    test('calls getEmptyStateOptions with correct parameters', () => {
      render(<scene.Component model={scene} />);

      expect(mockGetEmptyStateOptions).toHaveBeenCalledWith(type, scene);
    });
  });
});
