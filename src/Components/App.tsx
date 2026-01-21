import React, { lazy, useEffect, useState } from 'react';

import { AppRootProps } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';

import { initializeFeatureFlags, initOpenFeatureProvider } from 'featureFlags/openFeature';
import { logger } from 'services/logger';

const LogExplorationView = lazy(() => import('./LogExplorationPage'));
const PluginPropsContext = React.createContext<AppRootProps | null>(null);

// Initialize OpenFeature provider and populate flag cache
const featureFlagsReady = initOpenFeatureProvider().then(() => initializeFeatureFlags());

const App = (props: AppRootProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize and cache the feature flags for use in the app
    featureFlagsReady.then(() => {
      setIsReady(true);
    });
    // Log plugin loading success for SLO monitoring
    logger.info('Plugin loaded successfully');
  }, []);

  // Show a loading spinner until the feature flags are ready
  if (!isReady) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  return (
    <PluginPropsContext.Provider value={props}>
      <LogExplorationView />
    </PluginPropsContext.Provider>
  );
};

export default App;
