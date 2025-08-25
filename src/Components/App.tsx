import React, { lazy } from 'react';

import { AppRootProps } from '@grafana/data';

const LogExplorationView = lazy(() => import('./LogExplorationPage'));

const PluginPropsContext = React.createContext<AppRootProps | null>(null);

// Initialize Faro for internal observability
import('faro/faroInit').then((module) => {
  module.initFaro();
});

class App extends React.PureComponent<AppRootProps> {
  render() {
    return (
      <PluginPropsContext.Provider value={this.props}>
        <LogExplorationView />
      </PluginPropsContext.Provider>
    );
  }
}

export default App;
