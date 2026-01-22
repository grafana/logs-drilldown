import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { sceneGraph } from '@grafana/scenes';

import { SaveSearchModal } from './SaveSearchModal';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { useCheckForExistingSearch, useSavedSearches } from 'services/saveSearch';
import { getQueryExpr } from 'services/scenes';

jest.mock('services/saveSearch');
jest.mock('services/scenes');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: jest.fn(),
  })),
  reportInteraction: jest.fn(),
}));

const mockUseSaveSearches = jest.mocked(useSavedSearches);
const mockUseCheckForExistingSearch = jest.mocked(useCheckForExistingSearch);
const mockGetQueryExpr = jest.mocked(getQueryExpr);

describe('SaveSearchModal', () => {
  const mockOnClose = jest.fn();
  const mockSaveSearch = jest.fn();
  const mockSceneRef = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCheckForExistingSearch.mockReturnValue(undefined);
    mockGetQueryExpr.mockReturnValue('{job="test"}');
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({} as IndexScene);

    mockUseSaveSearches.mockReturnValue({
      saveSearch: mockSaveSearch,
      isLoading: false,
      searches: [],
      deleteSearch: jest.fn(),
    });
  });

  test('renders the modal with query', () => {
    render(<SaveSearchModal dsUid="test-ds" onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(screen.getByText('Save current search')).toBeInTheDocument();
    expect(screen.getByText('{job="test"}')).toBeInTheDocument();
  });

  test('submits the form with title and description', async () => {
    mockSaveSearch.mockResolvedValue(undefined);

    render(<SaveSearchModal dsUid="test-ds" onClose={mockOnClose} sceneRef={mockSceneRef} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'My Search' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test description' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockSaveSearch).toHaveBeenCalledWith({
        description: 'Test description',
        dsUid: 'test-ds',
        query: '{job="test"}',
        title: 'My Search',
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('shows alert when search already exists', () => {
    mockUseCheckForExistingSearch.mockReturnValue({
      description: 'Test description',
      dsUid: 'test-ds',
      query: '{job="test"}',
      title: 'Existing Search',
      timestamp: 123456,
      uid: 'test',
    });

    render(<SaveSearchModal dsUid="test-ds" onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(screen.getByText(/previously saved search/i)).toBeInTheDocument();
    expect(screen.getByText(/existing search/i)).toBeInTheDocument();
  });

  test('disables submit button when title is empty', () => {
    render(<SaveSearchModal dsUid="test-ds" onClose={mockOnClose} sceneRef={mockSceneRef} />);

    const submitButton = screen.getByRole('button', { name: /^save$/i });
    expect(submitButton).toBeDisabled();
  });
});
