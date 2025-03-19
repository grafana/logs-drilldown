import React, { useEffect } from 'react';

import { SceneApp, useSceneApp } from '@grafana/scenes';
import { config, usePluginComponent } from '@grafana/runtime';
import { Redirect } from 'react-router-dom';
import { makeIndexPage, makeRedirectPage } from './Pages';
import { initializeMetadataService } from '../services/metadata';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

const getSceneApp = () =>
  new SceneApp({
    pages: [makeIndexPage(), makeRedirectPage()],
    urlSyncOptions: {
      createBrowserHistorySteps: false,
      updateUrlOnInit: true,
    },
  });

function LogExplorationView() {
  const [isInitialized, setIsInitialized] = React.useState(false);
  const styles = useStyles2(getStyles);
  const { component: InvestigationsSidebar } = usePluginComponent('grafana-investigations-app/sidebar/v1');

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
    return <Redirect to="/" />;
  }

  if (!isInitialized) {
    return null;
  }

  if (InvestigationsSidebar) {
    return (
      <div className={styles.container}>
        <scene.Component model={scene} />
        <InvestigationsSidebar />
      </div>
    );
  }
  return <scene.Component model={scene} />;
}

export default LogExplorationView;

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'row',
      height: `calc(100vh - ${theme.spacing(5)})`,

      '& > div': {
        overflowY: 'auto',
        overflowX: 'hidden',
      },
      '& > div:first-child': {
        flex: 3,
      },
      '& > div:last-child': {
        flex: 1,
      },
    }),
  };
}
