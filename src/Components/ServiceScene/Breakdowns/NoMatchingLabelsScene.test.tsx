import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OpenAssistantButton } from '@grafana/assistant';

import { NoMatchingLabelsScene } from './NoMatchingLabelsScene';
import { getEmptyStateOptions } from 'services/extensions/embedding';

// Mock dependencies
jest.mock('@grafana/assistant', () => ({ OpenAssistantButton: jest.fn(() => null) }));
jest.mock('services/extensions/embedding');

const mockOpenAssistantButton = jest.mocked(OpenAssistantButton);
const mockGetEmptyStateOptions = jest.mocked(getEmptyStateOptions);

const types: Array<'fields' | 'labels'> = ['labels', 'fields'];

describe('NoMatchingLabelsScene', () => {
  let scene: NoMatchingLabelsScene;
  let mockClearCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearCallback = jest.fn();
    mockGetEmptyStateOptions.mockReturnValue(undefined);
  });

  describe.each(types)('with type "%s"', (type: 'fields' | 'labels') => {
    beforeEach(() => {
      scene = new NoMatchingLabelsScene({ clearCallback: mockClearCallback, type });
    });

    test('renders no matching labels message', () => {
      render(<scene.Component model={scene} />);

      expect(screen.getByText(`No ${type} match these filters.`)).toBeInTheDocument();
    });

    test('renders clear filters button', () => {
      render(<scene.Component model={scene} />);

      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    test('calls clearCallback when clear filters button is clicked', async () => {
      render(<scene.Component model={scene} />);

      const clearButton = screen.getByText('Clear filters');
      await userEvent.click(clearButton);

      expect(mockClearCallback).toHaveBeenCalledTimes(1);
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
      const customPrompt = 'Custom investigation prompt for labels';
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
