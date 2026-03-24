import React, { lazy, Suspense } from 'react';

import { lt } from 'semver';

import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';

import pluginJson from '../../plugin.json';
import { EmbeddedLogsExplorationProps } from 'Components/EmbeddedLogsExploration/types';
import { OpenInLogsDrilldownButtonProps } from 'Components/OpenInLogsDrilldownButton/types';

const OpenInLogsDrilldownButton = lazy(async () => {
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources: scenesLoadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [scenesLoadResources]);

  const { loadResources } = await import('../../i18n/loadResources');
  const pluginLoaders = lt(config?.buildInfo?.version || '0.0.0', '12.1.0') ? [loadResources] : [];
  await initPluginTranslations(pluginJson.id, pluginLoaders);

  return import('Components/OpenInLogsDrilldownButton/OpenInLogsDrilldownButton');
});

const EmbeddedLogsExploration = lazy(async () => {
  const { initPluginTranslations } = await import('@grafana/i18n');
  const { loadResources: scenesLoadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [scenesLoadResources]);

  const { loadResources } = await import('../../i18n/loadResources');
  const pluginLoaders = lt(config?.buildInfo?.version || '0.0.0', '12.1.0') ? [loadResources] : [];
  await initPluginTranslations(pluginJson.id, pluginLoaders);

  return import('Components/EmbeddedLogsExploration/EmbeddedLogs');
});

export function SuspendedOpenInLogsDrilldownButton(props: OpenInLogsDrilldownButtonProps) {
  return (
    <Suspense
      fallback={
        <LinkButton variant="secondary" disabled>
          Open in Logs Drilldown
        </LinkButton>
      }
    >
      <OpenInLogsDrilldownButton {...props} />
    </Suspense>
  );
}

export function SuspendedEmbeddedLogsExploration(props: EmbeddedLogsExplorationProps) {
  return (
    <Suspense fallback={<div>Loading Logs Drilldown...</div>}>
      <EmbeddedLogsExploration {...props} />
    </Suspense>
  );
}
