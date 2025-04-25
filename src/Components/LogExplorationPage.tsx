import React, { useEffect } from 'react';

import { Navigate } from 'react-router-dom';

import { config } from '@grafana/runtime';
import { SceneApp, useSceneApp } from '@grafana/scenes';

import { initializeMetadataService } from '../services/metadata';
import { makeIndexPage, makeRedirectPage } from './Pages';

const getSceneApp = () =>
  new SceneApp({
    pages: [makeIndexPage(), makeRedirectPage()],
    urlSyncOptions: {
      createBrowserHistorySteps: true,
      updateUrlOnInit: true,
    },
  });

function LogExplorationView() {
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

export default LogExplorationView;
