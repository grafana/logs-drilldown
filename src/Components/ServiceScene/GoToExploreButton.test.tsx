import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GoToExploreButton } from './GoToExploreButton';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { getDataSource, getQueryExpr } from 'services/scenes';
import { getDisplayedFields, getLogsVisualizationType } from 'services/store';

jest.mock('services/analytics', () => ({
  ...jest.requireActual('services/analytics'),
  reportInteraction: jest.fn(),
}));
jest.mock('services/store');
jest.mock('@grafana/scenes', () => {
  const actualScenes = jest.requireActual('@grafana/scenes');

  return {
    ...actualScenes,
    sceneGraph: {
      ...actualScenes.sceneGraph,
      getTimeRange: jest.fn().mockReturnValue({
        state: { value: { from: 'now-1h', raw: { from: 123456789, to: 987654321 }, to: 'now' } },
      }),
    },
  };
});
jest.mock('services/scenes');
beforeAll(() => {
  jest.spyOn(window, 'open').mockImplementation(jest.fn());
  jest.spyOn(URLSearchParams.prototype, 'get').mockImplementation(() => null);
  jest.mocked(getQueryExpr).mockReturnValue('{place="luna"} | logfmt');
  jest.mocked(getDataSource).mockReturnValue('gdev-loki');
});
afterAll(() => {
  jest.mocked(window.open).mockReset();
  jest.mocked(URLSearchParams.prototype.get).mockReset();
});

describe('GoToExploreButton', () => {
  describe('With logs visualization', () => {
    beforeEach(() => {
      jest.mocked(getDisplayedFields).mockReturnValue(['field1', 'field2']);
      jest.mocked(getLogsVisualizationType).mockReturnValue('logs');
      jest.mocked(window.open).mockClear();
    });
    test('Opens a new window with the current state in the Explore URL', async () => {
      render(<GoToExploreButton exploration={{} as IndexScene} />);

      await userEvent.click(screen.getByText('Open in Explore'));

      expect(window.open).toHaveBeenCalledWith(
        '/explore?panes=%7B%22loki-explore%22:%7B%22range%22:%7B%22from%22:123456789,%22to%22:987654321%7D,%22queries%22:%5B%7B%22refId%22:%22logs%22,%22expr%22:%22%7Bplace%3D%5C%22luna%5C%22%7D%20%7C%20logfmt%22,%22datasource%22:%22gdev-loki%22%7D%5D,%22panelsState%22:%7B%22logs%22:%7B%22displayedFields%22:%5B%22field1%22,%22field2%22%5D,%22visualisationType%22:%22logs%22%7D%7D,%22datasource%22:%22gdev-loki%22%7D%7D&schemaVersion=1',
        '_blank'
      );
    });
  });
  describe('With table visualization', () => {
    beforeEach(() => {
      jest.mocked(getDisplayedFields).mockReturnValue([]);
      jest.mocked(getLogsVisualizationType).mockReturnValue('table');
      jest.mocked(URLSearchParams.prototype.get).mockReturnValue('["field1", "field2"]');
      jest.mocked(window.open).mockClear();
    });
    test('Opens a new window with the current state in the Explore URL', async () => {
      render(<GoToExploreButton exploration={{} as IndexScene} />);

      await userEvent.click(screen.getByText('Open in Explore'));

      expect(window.open).toHaveBeenCalledWith(
        '/explore?panes=%7B%22loki-explore%22:%7B%22range%22:%7B%22from%22:123456789,%22to%22:987654321%7D,%22queries%22:%5B%7B%22refId%22:%22logs%22,%22expr%22:%22%7Bplace%3D%5C%22luna%5C%22%7D%20%7C%20logfmt%22,%22datasource%22:%22gdev-loki%22%7D%5D,%22panelsState%22:%7B%22logs%22:%7B%22displayedFields%22:%5B%5D,%22visualisationType%22:%22table%22,%22columns%22:%7B%220%22:%22field1%22,%221%22:%22field2%22%7D,%22labelFieldName%22:%22labels%22%7D%7D,%22datasource%22:%22gdev-loki%22%7D%7D&schemaVersion=1',
        '_blank'
      );
    });
  });
});
