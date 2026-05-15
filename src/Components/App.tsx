import React, { lazy } from 'react';

import { AppRootProps } from '@grafana/data';

import { FeatureFlagContext } from './FeatureFlagContext';

const LogExplorationView = lazy(() => import('./LogExplorationPage'));
const PluginPropsContext = React.createContext<AppRootProps | null>(null);

// Initialize Faro for internal observability
const { initFaro } = await import('faro/faroInit');
initFaro();

const App = (props: AppRootProps) => {
  return (
    <FeatureFlagContext>
      <PluginPropsContext.Provider value={props}>
        <LogExplorationView />
      </PluginPropsContext.Provider>
    </FeatureFlagContext>
  );
};

export default App;
