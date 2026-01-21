import React from 'react';

import { render, screen, fireEvent } from '@testing-library/react';

import { DataSourceVariable, sceneGraph, SceneTimeRange } from '@grafana/scenes';

import { LoadSearchScene } from './LoadSearchScene';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { useHasSavedSearches, useSavedSearches } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

jest.mock('services/saveSearch');
jest.mock('services/variableGetters');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn().mockReturnValue({ component: undefined, isLoading: false }),
}));

const mockUseHasSavedSearches = jest.mocked(useHasSavedSearches);
const mockGetDataSourceVariable = jest.mocked(getDataSourceVariable);
const mockUseSavedSearches = jest.mocked(useSavedSearches);

describe('LoadSearchScene', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDataSourceVariable.mockReturnValue({
      getValue: () => 'test-datasource-uid',
      subscribeToState: jest.fn(),
      state: {
        text: 'test-datasource-uid',
      },
    } as unknown as DataSourceVariable);
    mockUseSavedSearches.mockReturnValue({
      deleteSearch: jest.fn(),
      saveSearch: jest.fn(),
      searches: [],
      isLoading: false,
    });
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({} as IndexScene);
    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      state: { value: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } } },
    } as unknown as SceneTimeRange);
  });

  test('Disables button when there are no saved searches', () => {
    mockUseHasSavedSearches.mockReturnValue(false);

    const scene = new LoadSearchScene();
    render(<scene.Component model={scene} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  test('Enables button when there are saved searches', () => {
    mockUseHasSavedSearches.mockReturnValue(true);

    const scene = new LoadSearchScene();
    render(<scene.Component model={scene} />);

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });

  test('Opens modal when button is clicked', () => {
    mockUseHasSavedSearches.mockReturnValue(true);

    const scene = new LoadSearchScene();
    render(<scene.Component model={scene} />);

    expect(screen.queryByText('Load a previously saved search')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByText('Load a previously saved search')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));

    expect(screen.queryByText('Load a previously saved search')).not.toBeInTheDocument();
  });
});
