import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import { select } from 'react-select-event';

import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { DEFAULT_SORT_BY, setWasmInit } from 'services/sorting';
import { setSortByPreference } from 'services/store';

describe('SortByScene', () => {
  let scene: SortByScene;
  beforeEach(() => {
    localStorage.clear();
    setWasmInit(true);
    scene = new SortByScene({ target: 'fields' });
  });

  test('Shows changepoint as default when WASM init succeeded', () => {
    render(<scene.Component model={scene} />);

    expect(screen.getByText('Most relevant')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  test('Hides changepoint and outliers when WASM init failed', () => {
    setWasmInit(false);
    scene = new SortByScene({ target: 'fields' });
    render(<scene.Component model={scene} />);

    expect(screen.queryByText('Most relevant')).not.toBeInTheDocument();
    expect(screen.queryByText('Outlying values')).not.toBeInTheDocument();
    expect(screen.getByText('Widest spread')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  test('Retrieves stored sorting preferences', () => {
    setSortByPreference('fields', 'alphabetical', 'asc');

    scene = new SortByScene({ target: 'fields' });
    render(<scene.Component model={scene} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Asc')).toBeInTheDocument();
  });

  test('Reports sort-by criteria changes', async () => {
    const eventSpy = jest.spyOn(scene, 'publishEvent');

    render(<scene.Component model={scene} />);

    await waitFor(() => select(screen.getByLabelText('Sort by'), 'Highest spike', { container: document.body }));

    expect(eventSpy).toHaveBeenCalledWith(new SortCriteriaChanged('fields', 'max', 'desc'), true);
  });

  test('Reports sort-direction criteria changes', async () => {
    const eventSpy = jest.spyOn(scene, 'publishEvent');

    render(<scene.Component model={scene} />);

    await waitFor(() => select(screen.getByLabelText('Sort direction'), 'Asc', { container: document.body }));

    expect(eventSpy).toHaveBeenCalledWith(new SortCriteriaChanged('fields', DEFAULT_SORT_BY, 'asc'), true);
  });

  test('Overrides stored changepoint/outliers preference when WASM init failed', () => {
    setSortByPreference('fields', DEFAULT_SORT_BY, 'desc');
    setWasmInit(false);
    scene = new SortByScene({ target: 'fields' });
    render(<scene.Component model={scene} />);

    expect(screen.getByText('Widest spread')).toBeInTheDocument();
    expect(screen.queryByText('Most relevant')).not.toBeInTheDocument();
  });
});
