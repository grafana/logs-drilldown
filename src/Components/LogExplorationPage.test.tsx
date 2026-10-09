import React from 'react';

import { act, render, screen } from '@testing-library/react';

import { useSceneApp } from '@grafana/scenes';

import { plugin } from '../module';
import LogExplorationView from './LogExplorationPage';
import { InitialDatasourceInfo, resolveInitialDatasourceInfo } from 'services/initialDatasourceInfo';

jest.mock('services/initialDatasourceInfo', () => ({
  resolveInitialDatasourceInfo: jest.fn(),
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

describe('LogExplorationView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(useSceneApp)
      .mockReturnValue({ Component: () => <div>scene</div> } as unknown as ReturnType<typeof useSceneApp>);
  });

  it('does not create the scene app until the initial datasource info is resolved', async () => {
    let resolveInfo: (info: InitialDatasourceInfo) => void = () => {};
    jest.mocked(resolveInitialDatasourceInfo).mockReturnValue(
      new Promise<InitialDatasourceInfo>((resolve) => {
        resolveInfo = resolve;
      })
    );

    render(<LogExplorationView />);

    expect(screen.queryByText('scene')).not.toBeInTheDocument();
    expect(useSceneApp).not.toHaveBeenCalled();

    await act(async () => {
      resolveInfo({ defaultDatasourceUid: 'loki-uid', kgAnnotationsAvailable: false });
    });

    expect(await screen.findByText('scene')).toBeInTheDocument();
    expect(useSceneApp).toHaveBeenCalled();
  });

  describe('default datasource lookup', () => {
    const emptyInfo = { defaultDatasourceUid: undefined, kgAnnotationsAvailable: false };

    beforeEach(() => {
      jest.mocked(resolveInitialDatasourceInfo).mockResolvedValue(emptyInfo);
    });

    afterEach(() => {
      Object.assign(plugin.meta, { jsonData: {} });
    });

    it('asks for the default datasource when none is saved in the plugin settings', async () => {
      render(<LogExplorationView />);

      expect(await screen.findByText('scene')).toBeInTheDocument();
      expect(resolveInitialDatasourceInfo).toHaveBeenCalledWith({ needsDefaultDatasource: true });
    });

    it('skips the default datasource lookup when one is saved in the plugin settings', async () => {
      Object.assign(plugin.meta, { jsonData: { dataSource: 'saved-uid' } });

      render(<LogExplorationView />);

      expect(await screen.findByText('scene')).toBeInTheDocument();
      expect(resolveInitialDatasourceInfo).toHaveBeenCalledWith({ needsDefaultDatasource: false });
    });
  });
});
