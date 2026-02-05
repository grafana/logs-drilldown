import React from 'react';

import { render, screen, fireEvent } from '@testing-library/react';

import { usePluginComponent } from '@grafana/runtime';
import { DataSourceVariable, sceneGraph, SceneTimeRange } from '@grafana/scenes';

import { LoadSearchScene } from './LoadSearchScene';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { contextToLink } from 'services/extensions/links';
import { LokiQuery } from 'services/lokiQuery';
import { useHasSavedSearches, useSavedSearches, isQueryLibrarySupported } from 'services/saveSearch';
import { getDataSourceVariable } from 'services/variableGetters';

jest.mock('services/saveSearch');
jest.mock('services/variableGetters');
jest.mock('@grafana/runtime');
jest.mock('services/extensions/links');

const mockUseHasSavedSearches = jest.mocked(useHasSavedSearches);
const mockGetDataSourceVariable = jest.mocked(getDataSourceVariable);
const mockUseSavedSearches = jest.mocked(useSavedSearches);

function FakeExposedComponent({ onSelectQuery }: { onSelectQuery(query: LokiQuery): void }) {
  return (
    <div>
      <button
        onClick={() => {
          onSelectQuery({
            refId: 'A',
            datasource: {
              type: 'loki',
              uid: 'test-ds',
            },
            expr: '{job="test1"}',
          });
        }}
      >
        Select
      </button>
    </div>
  );
}

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
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: {
        embedded: false,
      },
    } as IndexScene);
    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      state: { value: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } } },
    } as unknown as SceneTimeRange);
    jest.mocked(contextToLink).mockReturnValue({ path: 'https://drilldown.com/link' });
    jest.mocked(usePluginComponent).mockReturnValue({ component: undefined, isLoading: false });
    jest.mocked(isQueryLibrarySupported).mockReturnValue(false);
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

  test('Returns null when the scene is embedded', () => {
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: { embedded: true },
    } as IndexScene);

    const scene = new LoadSearchScene();
    const { container } = render(<scene.Component model={scene} />);

    expect(container.firstChild).toBeNull();
  });

  test('Uses the exposed component if available', () => {
    const component = () => <div>Exposed component</div>;
    jest.mocked(isQueryLibrarySupported).mockReturnValue(true);
    jest.mocked(usePluginComponent).mockReturnValue({ component, isLoading: false });

    const scene = new LoadSearchScene();
    render(<scene.Component model={scene} />);

    expect(screen.getByText('Exposed component')).toBeInTheDocument();
  });

  describe('Loading a search', () => {
    beforeEach(() => {
      jest.mocked(contextToLink).mockClear();
      jest.mocked(isQueryLibrarySupported).mockReturnValue(true);
      jest.mocked(usePluginComponent).mockReturnValue({ component: FakeExposedComponent, isLoading: false });
      mockUseHasSavedSearches.mockReturnValue(true);
    });

    test('Creates a link to load a search with relative time', () => {
      const scene = new LoadSearchScene();
      render(<scene.Component model={scene} />);

      fireEvent.click(screen.getByText('Select'));

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
      jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
        state: {
          value: {
            from: '2026-02-05T11:26:55.860Z',
            to: '2026-02-05T11:31:55.860Z',
            raw: { from: '2026-02-05T11:26:55.860Z', to: '2026-02-05T11:31:55.860Z' },
          },
        },
      } as unknown as SceneTimeRange);

      const scene = new LoadSearchScene();
      render(<scene.Component model={scene} />);

      fireEvent.click(screen.getByText('Select'));

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
});
