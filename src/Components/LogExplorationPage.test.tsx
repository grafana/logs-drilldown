import React from 'react';

import { render, screen } from '@testing-library/react';

import { useSceneApp } from '@grafana/scenes';

import { plugin } from '../module';
import LogExplorationPage from './LogExplorationPage';
import { useDefaultDatasourceUid } from 'services/initialDatasourceInfo';

jest.mock('services/initialDatasourceInfo', () => ({
  useDefaultDatasourceUid: jest.fn(),
}));

jest.mock('../module', () => ({
  plugin: { meta: { jsonData: {} } },
}));

jest.mock('services/metadata', () => ({
  initializeMetadataService: jest.fn(),
}));

jest.mock('./Pages', () => ({
  makeEmbeddedPage: jest.fn(),
  makeIndexPage: jest.fn(),
  makeRedirectPage: jest.fn(),
}));

jest.mock('@grafana/scenes', () => ({
  SceneApp: jest.fn(),
  useSceneApp: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  config: { bootData: { user: { permissions: { 'grafana-lokiexplore-app:read': true } } } },
}));

jest.mock('react-router-dom', () => ({
  Navigate: () => <div>redirected</div>,
}));

describe('LogExplorationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(useSceneApp)
      .mockReturnValue({ Component: () => <div>scene</div> } as unknown as ReturnType<typeof useSceneApp>);
  });

  it('does not create the scene app until the initial datasource info is resolved', () => {
    jest.mocked(useDefaultDatasourceUid).mockReturnValue({ dsUID: undefined, isLoading: true });

    const { rerender } = render(<LogExplorationPage />);

    expect(screen.queryByText('scene')).not.toBeInTheDocument();
    expect(useSceneApp).not.toHaveBeenCalled();

    jest.mocked(useDefaultDatasourceUid).mockReturnValue({ dsUID: 'loki-uid', isLoading: false });
    rerender(<LogExplorationPage />);

    expect(screen.getByText('scene')).toBeInTheDocument();
    expect(useSceneApp).toHaveBeenCalled();
  });

  describe('default datasource lookup', () => {
    beforeEach(() => {
      jest.mocked(useDefaultDatasourceUid).mockReturnValue({ dsUID: undefined, isLoading: false });
    });

    afterEach(() => {
      Object.assign(plugin.meta, { jsonData: {} });
    });

    it('asks for the default datasource when none is saved in the plugin settings', () => {
      render(<LogExplorationPage />);

      expect(screen.getByText('scene')).toBeInTheDocument();
      expect(useDefaultDatasourceUid).toHaveBeenCalledWith(undefined, { preferLastUsed: true });
    });

    it('skips the default datasource lookup when one is saved in the plugin settings', () => {
      Object.assign(plugin.meta, { jsonData: { dataSource: 'saved-uid' } });

      render(<LogExplorationPage />);

      expect(screen.getByText('scene')).toBeInTheDocument();
      expect(useDefaultDatasourceUid).toHaveBeenCalledWith('saved-uid', { preferLastUsed: true });
    });
  });
});
