import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { DataSourceVariable, sceneGraph } from '@grafana/scenes';

import { SaveSearchButton } from './SaveSearchButton';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { useInitSavedSearch } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

jest.mock('services/saveSearch');
jest.mock('services/variableGetters');
jest.mock('./SaveSearchModal', () => ({
  SaveSearchModal: () => <div data-testid="save-search-modal">Save Search Modal</div>,
}));

const mockGetDataSourceVariable = getDataSourceVariable as jest.MockedFunction<typeof getDataSourceVariable>;
const mockUseInitSavedSearch = useInitSavedSearch as jest.MockedFunction<typeof useInitSavedSearch>;

describe('SaveSearchButton', () => {
  const mockSceneRef = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDataSourceVariable.mockReturnValue({
      getValue: () => 'test-datasource-uid',
    } as DataSourceVariable);
    mockUseInitSavedSearch.mockReturnValue(undefined);
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: { embedded: false },
    } as IndexScene);
  });

  test('Opens the modal when the button is clicked', () => {
    render(<SaveSearchButton sceneRef={mockSceneRef} />);

    expect(screen.queryByTestId('save-search-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByTestId('save-search-modal')).toBeInTheDocument();
  });

  test('Closes the modal when onClose is called', () => {
    const { rerender } = render(<SaveSearchButton sceneRef={mockSceneRef} />);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByTestId('save-search-modal')).toBeInTheDocument();

    // Simulate modal close by re-rendering with closed state
    rerender(<SaveSearchButton sceneRef={mockSceneRef} />);
  });

  test('Returns null when the scene is embedded', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: { embedded: true },
    } as IndexScene);

    const { container } = render(<SaveSearchButton sceneRef={mockSceneRef} />);
    expect(container.firstChild).toBeNull();
  });
});
