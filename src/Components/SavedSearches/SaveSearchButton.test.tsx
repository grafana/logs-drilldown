import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { usePluginComponent } from '@grafana/runtime';
import { DataSourceVariable, sceneGraph } from '@grafana/scenes';

import { SaveSearchButton } from './SaveSearchButton';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { isQueryLibrarySupported, useSavedSearches } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

jest.mock('services/saveSearch');
jest.mock('services/variableGetters');
jest.mock('@grafana/runtime');

const mockGetDataSourceVariable = jest.mocked(getDataSourceVariable);
const mockUseSaveSearches = jest.mocked(useSavedSearches);

describe('SaveSearchButton', () => {
  const mockSceneRef = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDataSourceVariable.mockReturnValue({
      getValue: () => 'test-datasource-uid',
      state: {
        text: 'test-datasource-uid',
      },
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
    jest.mocked(usePluginComponent).mockReturnValue({ component: undefined, isLoading: false });
    jest.mocked(isQueryLibrarySupported).mockReturnValue(false);
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

  test('Uses the exposed component if available', () => {
    const component = () => <div>Exposed component</div>;
    jest.mocked(isQueryLibrarySupported).mockReturnValue(true);
    jest.mocked(usePluginComponent).mockReturnValue({ component, isLoading: false });

    render(<SaveSearchButton sceneRef={mockSceneRef} />);

    expect(screen.getByText('Exposed component')).toBeInTheDocument();
  });
});
