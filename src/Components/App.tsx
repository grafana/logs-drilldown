import React, { lazy } from 'react';

import { AppRootProps } from '@grafana/data';

import { initOpenFeatureProvider } from 'featureFlags/openFeature';
import { logger } from 'services/logger';

const LogExplorationView = lazy(() => import('./LogExplorationPage'));
const PluginPropsContext = React.createContext<AppRootProps | null>(null);

// Initialize OpenFeature Feature Flags
initOpenFeatureProvider();
class App extends React.PureComponent<AppRootProps> {
  componentDidMount() {
    // Log plugin loading success for SLO monitoring
    logger.info('Plugin loaded successfully');
  }
  render() {
    return (
      <PluginPropsContext.Provider value={this.props}>
        <LogExplorationView />
      </PluginPropsContext.Provider>
    );
  }
}

export default App;
