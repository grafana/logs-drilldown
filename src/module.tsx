import { lazy } from 'react';
import { AppPlugin } from '@grafana/data';
import { linkConfigs } from 'services/extensions/links';
import {
  SuspendedEmbeddedLogsExploration,
  SuspendedOpenInLogsDrilldownButton,
} from 'services/extensions/exposedComponents';

// Anything imported in this file is included in the main bundle which is pre-loaded in Grafana
// Don't add imports to this file without lazy loading
// Link extensions are the exception as they must be included in the main bundle in order to work in core Grafana
const App = lazy(async () => {
  const { wasmSupported } = await import('services/sorting');

  const { default: initRuntimeDs } = await import('services/datasource');
  const { default: initChangepoint } = await import('@bsull/augurs/changepoint');
  const { default: initOutlier } = await import('@bsull/augurs/outlier');

  initRuntimeDs();

  if (wasmSupported()) {
    await Promise.all([initChangepoint(), initOutlier()]);
  }

  return import('Components/App');
});

const AppConfig = lazy(async () => {
  return await import('./Components/AppConfig/AppConfig');
});

export const plugin = new AppPlugin<{}>().setRootPage(App).addConfigPage({
  title: 'Configuration',
  icon: 'cog',
  body: AppConfig,
  id: 'configuration',
});

for (const linkConfig of linkConfigs) {
  plugin.addLink(linkConfig);
}

plugin.exposeComponent({
  id: `grafana-lokiexplore-app/open-in-explore-logs-button/v1`,
  title: 'Open in Logs Drilldown button',
  description: 'A button that opens a logs view in the Logs Drilldown app.',
  component: SuspendedOpenInLogsDrilldownButton,
});

plugin.exposeComponent({
  id: `grafana-lokiexplore-app/embedded-logs-exploration/v1`,
  title: 'Embedded Logs Exploration',
  description: 'A component that renders a logs exploration view that can be embedded in other parts of Grafana.',
  component: SuspendedEmbeddedLogsExploration,
});
