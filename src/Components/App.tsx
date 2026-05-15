import React, { lazy, useEffect } from 'react';

import { AppRootProps } from '@grafana/data';

import { FeatureFlagContext } from './FeatureFlagContext';

const LogExplorationView = lazy(() => import('./LogExplorationPage'));
const PluginPropsContext = React.createContext<AppRootProps | null>(null);

const App = (props: AppRootProps) => {
  useEffect(() => {
    void import('faro/faroInit').then((m) => m.initFaro());
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
