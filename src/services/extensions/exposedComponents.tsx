import React, { lazy, Suspense } from 'react';

import { Trans } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';

import pluginJson from '../../plugin.json';
import { EmbeddedLogsExplorationProps } from 'Components/EmbeddedLogsExploration/types';
import { OpenInLogsDrilldownButtonProps } from 'Components/OpenInLogsDrilldownButton/types';

const initI18n = async () => {
  const { lt } = await import('semver');
  const { config } = await import('@grafana/runtime');
  const { initPluginTranslations } = await import('@grafana/i18n');

  const { loadResources: scenesLoadResources } = await import('@grafana/scenes');
  await initPluginTranslations('grafana-scenes', [scenesLoadResources]);

  const { loadResources } = await import('../../i18n/loadResources');
  const pluginLoaders = lt(config?.buildInfo?.version || '0.0.0', '12.1.0') ? [loadResources] : [];
  await initPluginTranslations(pluginJson.id, pluginLoaders);
};

const OpenInLogsDrilldownButton = lazy(async () => {
  await initI18n();
  return import('Components/OpenInLogsDrilldownButton/OpenInLogsDrilldownButton');
});

const EmbeddedLogsExploration = lazy(async () => {
  await initI18n();
  return import('Components/EmbeddedLogsExploration/EmbeddedLogs');
});

export function SuspendedOpenInLogsDrilldownButton(props: OpenInLogsDrilldownButtonProps) {
  return (
    <Suspense
      fallback={
        <LinkButton variant="secondary" disabled><Trans i18nKey="services.suspended-open-in-logs-drilldown-button.open-in-logs-drilldown">
          Open in Logs Drilldown
        </Trans></LinkButton>
      }
    >
      <OpenInLogsDrilldownButton {...props} />
    </Suspense>
  );
}

export function SuspendedEmbeddedLogsExploration(props: EmbeddedLogsExplorationProps) {
  return (
    <Suspense fallback={<div><Trans i18nKey="services.suspended-embedded-logs-exploration.loading-logs-drilldown">Loading Logs Drilldown...</Trans></div>}>
      <EmbeddedLogsExploration {...props} />
    </Suspense>
  );
}
