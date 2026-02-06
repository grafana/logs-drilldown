import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { DataSourceVariable, sceneGraph, SceneTimeRange } from '@grafana/scenes';

import { LoadSearchModal } from './LoadSearchModal';
import { contextToLink } from 'services/extensions/links';
import { SavedSearch, useSavedSearches } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

jest.mock('services/saveSearch');
jest.mock('services/variableGetters');
jest.mock('services/extensions/links');

const mockUseSavedSearches = useSavedSearches as jest.MockedFunction<typeof useSavedSearches>;
const mockGetDataSourceVariable = getDataSourceVariable as jest.MockedFunction<typeof getDataSourceVariable>;

const mockSearches: SavedSearch[] = [
  {
    uid: '1',
    title: 'Test Search 1',
    description: 'First test search',
    query: '{job="test1"}',
    dsUid: 'test-ds',
    timestamp: Date.now(),
  },
  {
    uid: '2',
    title: 'Test Search 2',
    description: 'Second test search',
    query: '{job="test2"}',
    dsUid: 'test-ds',
    timestamp: Date.now() - 1,
  },
];

describe('LoadSearchModal', () => {
  const mockOnClose = jest.fn();
  const mockDeleteSearch = jest.fn();
  const mockSceneRef = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDataSourceVariable.mockReturnValue({
      getValue: () => 'test-ds',
    } as DataSourceVariable);
    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      state: { value: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } } },
    } as unknown as SceneTimeRange);
    jest.mocked(contextToLink).mockReturnValue({ path: 'https://drilldown.com/link' });
    mockUseSavedSearches.mockReturnValue({
      saveSearch: jest.fn(),
      searches: mockSearches,
      isLoading: false,
      deleteSearch: mockDeleteSearch,
    });
  });

  test('renders the modal with saved searches', () => {
    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(screen.getAllByText('Test Search 1')).toHaveLength(2);
    expect(screen.getByText('Test Search 2')).toBeInTheDocument();
  });

  test('Renders empty state when no searches', () => {
    mockUseSavedSearches.mockReturnValue({
      saveSearch: jest.fn(),
      searches: [],
      isLoading: false,
      deleteSearch: mockDeleteSearch,
    });

    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(screen.getByText('No saved searches to display.')).toBeInTheDocument();
  });

  test('Selects a search when clicked', () => {
    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    fireEvent.click(screen.getAllByLabelText('Test Search 2')[0]);

    expect(screen.getByText('{job="test2"}')).toBeInTheDocument();
  });

  test('Calls deleteSearch when delete button is clicked', () => {
    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    const deleteButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(deleteButton);

    expect(mockDeleteSearch).toHaveBeenCalledWith('1');
  });

  test('Calls deleteSearch when delete button is clicked', () => {
    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    const deleteButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(deleteButton);

    expect(mockDeleteSearch).toHaveBeenCalledWith('1');
  });

  test('Creates a link to load a search with relative time', () => {
    jest.mocked(contextToLink).mockClear();

    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(contextToLink).toHaveBeenCalledWith({
      targets: [
        {
          datasource: {
            type: 'loki',
            uid: 'test-ds',
          },
          expr: '{job="test1"}',
          refId: 'A',
        },
      ],
      timeRange: {
        from: 'now-1h',
        to: 'now',
      },
    });
  });

  test('Creates a link to load a search with absolute time', () => {
    jest.mocked(contextToLink).mockClear();
    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      state: {
        value: {
          from: '2026-02-05T11:26:55.860Z',
          to: '2026-02-05T11:31:55.860Z',
          raw: { from: '2026-02-05T11:26:55.860Z', to: '2026-02-05T11:31:55.860Z' },
        },
      },
    } as unknown as SceneTimeRange);

    render(<LoadSearchModal onClose={mockOnClose} sceneRef={mockSceneRef} />);

    expect(contextToLink).toHaveBeenCalledWith({
      targets: [
        {
          datasource: {
            type: 'loki',
            uid: 'test-ds',
          },
          expr: '{job="test1"}',
          refId: 'A',
        },
      ],
      timeRange: {
        from: '2026-02-05T11:26:55.860Z',
        to: '2026-02-05T11:31:55.860Z',
      },
    });
  });
});
