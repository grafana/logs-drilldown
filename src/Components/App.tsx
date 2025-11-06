import React, { lazy, useEffect } from 'react';

import { AppRootProps } from '@grafana/data';
import { usePluginFunctions } from '@grafana/runtime';

import initRuntimeDs from '../services/datasource';
import { logger } from '../services/logger';

const LogExplorationView = lazy(() => import('./LogExplorationPage'));
const PluginPropsContext = React.createContext<AppRootProps | null>(null);

type ContextForLinksFn = () => string;

function App(props: AppRootProps) {
  const { functions: logsDrilldownExtensions, isLoading } = usePluginFunctions<ContextForLinksFn>({
    extensionPointId: 'grafana-lokiexplore-app/get-logs-drilldown-link/v1',
    limitPerPlugin: 1,
  });

  useEffect(() => {
    if (isLoading) {
      return;
    }
    logger.info('Plugin loaded successfully');
    const fn: ContextForLinksFn = logsDrilldownExtensions?.[0]?.fn ?? (() => null);
    initRuntimeDs(fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  return (
    <PluginPropsContext.Provider value={props}>
      <LogExplorationView />
    </PluginPropsContext.Provider>
  );
}

export default App;
