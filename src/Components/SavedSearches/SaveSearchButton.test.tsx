import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { DataSourceVariable, sceneGraph } from '@grafana/scenes';

import { SaveSearchButton } from './SaveSearchButton';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { useSavedSearches } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

jest.mock('services/saveSearch');
jest.mock('services/variableGetters');

const mockGetDataSourceVariable = jest.mocked(getDataSourceVariable);
const mockUseSaveSearches = jest.mocked(useSavedSearches);

describe('SaveSearchButton', () => {
  const mockSceneRef = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDataSourceVariable.mockReturnValue({
      getValue: () => 'test-datasource-uid',
    } as DataSourceVariable);
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: { embedded: false },
    } as IndexScene);
    mockUseSaveSearches.mockReturnValue({
      saveSearch: jest.fn(),
      isLoading: false,
      searches: [],
      deleteSearch: jest.fn(),
    });
  });

  test('Opens the modal when the button is clicked', () => {
    render(<SaveSearchButton sceneRef={mockSceneRef} />);

    expect(screen.queryByText('Save current search')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    expect(screen.getByText('Save current search')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(screen.queryByText('Save current search')).not.toBeInTheDocument();
  });

  test('Returns null when the scene is embedded', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: { embedded: true },
    } as IndexScene);

    const { container } = render(<SaveSearchButton sceneRef={mockSceneRef} />);
    expect(container.firstChild).toBeNull();
  });
});
