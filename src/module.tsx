import { lazy } from 'react';

import { AppPlugin } from '@grafana/data';

import type { JsonData } from './Components/AppConfig/AppConfig';
import pluginJson from 'plugin.json';
import {
  SuspendedEmbeddedLogsExploration,
  SuspendedErrorsAnalysis,
  SuspendedOpenInLogsDrilldownButton,
} from 'services/extensions/exposedComponents';
import { functionConfigs, linkConfigs } from 'services/extensions/links';

// Anything imported in this file is included in the main bundle which is pre-loaded in Grafana
// Don't add imports to this file without lazy loading
// Link extensions are the exception as they must be included in the main bundle in order to work in core Grafana
const initPluginI18n = async () => {
  const { lt } = await import('semver');
  const { config } = await import('@grafana/runtime');
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources } = await import('./i18n/loadResources');
  const pluginLoaders = lt(config?.buildInfo?.version || '0.0.0', '12.1.0') ? [loadResources] : [];
  await initPluginTranslations(pluginJson.id, pluginLoaders);
};

const App = lazy(async () => {
  const { initPluginTranslations } = await import('@grafana/i18n');

  // Initialize i18n for scenes library
  const { loadResources: scenesLoadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [scenesLoadResources]);

  // Initialize i18n for this plugin
  await initPluginI18n();

  const { logger } = await import('services/logger');
  const { setWasmSortInit, wasmSupported } = await import('services/sorting');

  const { default: initRuntimeDs } = await import('services/datasource');
  const { default: initChangepoint } = await import('@bsull/augurs/changepoint');
  const { default: initOutlier } = await import('@bsull/augurs/outlier');

  initRuntimeDs();

  if (wasmSupported()) {
    try {
      await Promise.all([initChangepoint(), initOutlier()]);
      setWasmSortInit(true);
    } catch (e) {
      logger.warn('WebAssembly init failed, ML sorting disabled.');
      setWasmSortInit(false);
    }
  }

  return import('Components/App');
});

const AppConfig = lazy(async () => {
  await initPluginI18n();
  return await import('./Components/AppConfig/AppConfig');
});

const DefaultColumnsConfig = lazy(async () => {
  await initPluginI18n();
  return await import('./Components/AppConfig/DefaultColumns/Config');
});

const ServiceSelectionConfig = lazy(async () => {
  await initPluginI18n();
  return await import('./Components/AppConfig/ServiceSelection/Config');
});

export const plugin = new AppPlugin<JsonData>()
  .setRootPage(App)
  .addConfigPage({
    body: AppConfig,
    icon: 'cog',
    id: 'configuration',
    title: 'Configuration',
  })
  .addConfigPage({
    body: ServiceSelectionConfig,
    icon: 'home-alt',
    id: 'admin-service-selection',
    title: 'Landing Page',
  })
  .addConfigPage({
    body: DefaultColumnsConfig,
    icon: 'columns',
    id: 'admin-default-fields',
    title: 'Default fields',
  });

for (const linkConfig of linkConfigs) {
  plugin.addLink(linkConfig);
}

for (const functionConfig of functionConfigs) {
  plugin.addFunction(functionConfig);
}

plugin.exposeComponent({
  component: SuspendedOpenInLogsDrilldownButton,
  description: 'A button that opens a logs view in the Logs Drilldown app.',
  id: `grafana-lokiexplore-app/open-in-explore-logs-button/v1`,
  title: 'Open in Logs Drilldown button',
});

plugin.exposeComponent({
  component: SuspendedEmbeddedLogsExploration,
  description: 'A component that renders a logs exploration view that can be embedded in other parts of Grafana.',
  id: `grafana-lokiexplore-app/embedded-logs-exploration/v1`,
  title: 'Embedded Logs Exploration',
});

plugin.exposeComponent({
  component: SuspendedErrorsAnalysis,
  description: 'An errors analysis view for a given Faro app.',
  id: `grafana-lokiexplore-app/errors-analysis/v1`,
  title: 'Errors Analysis',
});
