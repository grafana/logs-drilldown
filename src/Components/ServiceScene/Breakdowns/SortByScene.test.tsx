import React from 'react';

import { render, screen } from '@testing-library/react';

import { ReducerID } from '@grafana/data';

import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { DEFAULT_SORT_BY, setWasmSortInit } from 'services/sorting';
import { setSortByPreference } from 'services/store';

describe('SortByScene', () => {
  let scene: SortByScene;
  beforeEach(() => {
    localStorage.clear();
    setWasmSortInit(true);
    scene = new SortByScene({ target: 'fields' });
  });

  test('Shows changepoint as default when WASM init succeeded', () => {
    render(<scene.Component model={scene} />);

    expect(screen.getByDisplayValue('Most relevant')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Desc')).toBeInTheDocument();
  });

  test('Hides changepoint and outliers when WASM init failed', () => {
    setWasmSortInit(false);
    scene = new SortByScene({ target: 'fields' });
    render(<scene.Component model={scene} />);

    expect(screen.queryByDisplayValue('Most relevant')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Outlying values')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Widest spread')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Desc')).toBeInTheDocument();
  });

  test('Retrieves stored sorting preferences', () => {
    setSortByPreference('fields', 'alphabetical', 'asc');

    scene = new SortByScene({ target: 'fields' });
    render(<scene.Component model={scene} />);

    expect(screen.getByDisplayValue('Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Asc')).toBeInTheDocument();
  });

  test('Reports sort-by criteria changes', () => {
    const eventSpy = jest.spyOn(scene, 'publishEvent');

    scene.onCriteriaChange({ label: 'Highest spike', value: ReducerID.max });

    expect(eventSpy).toHaveBeenCalledWith(new SortCriteriaChanged('fields', 'max', 'desc'), true);
  });

  test('Reports sort-direction criteria changes', () => {
    const eventSpy = jest.spyOn(scene, 'publishEvent');

    scene.onDirectionChange({ label: 'Asc', value: 'asc' });

    expect(eventSpy).toHaveBeenCalledWith(new SortCriteriaChanged('fields', DEFAULT_SORT_BY, 'asc'), true);
  });

  test('Overrides stored changepoint/outliers preference when WASM init failed', () => {
    setSortByPreference('fields', DEFAULT_SORT_BY, 'desc');
    setWasmSortInit(false);
    scene = new SortByScene({ target: 'fields' });
    render(<scene.Component model={scene} />);

    expect(screen.getByDisplayValue('Widest spread')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Most relevant')).not.toBeInTheDocument();
  });
});
