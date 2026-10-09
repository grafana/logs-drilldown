import React, { useEffect } from 'react';

import { Navigate } from 'react-router-dom';

import { config } from '@grafana/runtime';
import { SceneApp, useSceneApp } from '@grafana/scenes';

import { plugin } from '../module';
import { makeEmbeddedPage, makeIndexPage, makeRedirectPage } from './Pages';
import { resolveInitialDatasourceInfo } from 'services/initialDatasourceInfo';
import { initializeMetadataService } from 'services/metadata';

const getSceneApp = () =>
  new SceneApp({
    pages: [makeIndexPage(), makeEmbeddedPage(), makeRedirectPage()],
    urlSyncOptions: {
      createBrowserHistorySteps: true,
      updateUrlOnInit: true,
    },
  });

function LogExplorationScene() {
  const [isInitialized, setIsInitialized] = React.useState(false);

  initializeMetadataService();

  const scene = useSceneApp(getSceneApp);

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [scene, isInitialized]);

  const userPermissions = config.bootData.user.permissions;
  const canUseApp = userPermissions?.['grafana-lokiexplore-app:read'] || userPermissions?.['datasources:explore'];
  if (!canUseApp) {
    return <Navigate to="/" replace />;
  }

  if (!isInitialized) {
    return null;
  }

  return <scene.Component model={scene} />;
}

// Scene constructors read the default datasource synchronously, so resolve it first.
function LogExplorationView() {
  const [isResolved, setIsResolved] = React.useState(false);

  useEffect(() => {
    let cancelled = false;
    void resolveInitialDatasourceInfo({ needsDefaultDatasource: !plugin.meta.jsonData?.dataSource }).then(() => {
      if (!cancelled) {
        setIsResolved(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isResolved) {
    return null;
  }

  return <LogExplorationScene />;
}

export default LogExplorationView;
