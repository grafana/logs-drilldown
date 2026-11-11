import React, { lazy, useEffect } from 'react';

import { AppRootProps } from '@grafana/data';

import { FeatureFlagContext } from './FeatureFlagContext';
import { setAdminLogDefaults } from 'services/logDefaults';

const LogExplorationPage = lazy(() => import('./LogExplorationPage'));
const PluginPropsContext = React.createContext<AppRootProps | null>(null);

const App = (props: AppRootProps) => {
  // Set during render so scenes created by children read the admin defaults
  setAdminLogDefaults(props.meta.jsonData?.logDefaults);

  // Initialize Faro for internal observability
  useEffect(() => {
    void import('faro/faroInit')
      .then(({ initFaro }) => {
        void initFaro();
      })
      .catch((error) => {
        console.error('Failed to initialize Faro', error);
      });
  }, []);

  return (
    <FeatureFlagContext>
      <PluginPropsContext.Provider value={props}>
        <LogExplorationPage />
      </PluginPropsContext.Provider>
    </FeatureFlagContext>
  );
};

export default App;
