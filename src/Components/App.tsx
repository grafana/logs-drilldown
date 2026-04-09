import React, { lazy, useEffect } from 'react';

import { AppRootProps } from '@grafana/data';

import { FeatureFlagContext } from './FeatureFlagContext';
import { logger } from 'services/logger';

const LogExplorationView = lazy(() => import('./LogExplorationPage'));
const PluginPropsContext = React.createContext<AppRootProps | null>(null);

const App = (props: AppRootProps) => {
  useEffect(() => {
    // Log plugin loading success for SLO monitoring
    logger.info('Plugin loaded successfully');
  }, []);

  return (
    <FeatureFlagContext>
      <PluginPropsContext.Provider value={props}>
        <LogExplorationView />
      </PluginPropsContext.Provider>
    </FeatureFlagContext>
  );
};

export default App;
