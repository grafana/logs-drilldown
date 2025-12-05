import React, { lazy, Suspense } from 'react';

import { initPluginTranslations } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';

import pluginJson from '../../plugin.json';
import { EmbeddedLogsExplorationProps } from 'Components/EmbeddedLogsExploration/types';
import { OpenInLogsDrilldownButtonProps } from 'Components/OpenInLogsDrilldownButton/types';
const OpenInLogsDrilldownButton = lazy(() => import('Components/OpenInLogsDrilldownButton/OpenInLogsDrilldownButton'));
const EmbeddedLogsExploration = lazy(() => import('Components/EmbeddedLogsExploration/EmbeddedLogs'));

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
  // Need to init plugin translations or plugins that don't use translations will sometimes break
  initPluginTranslations(pluginJson.id);
  return (
    <Suspense fallback={<div>Loading Logs Drilldown...</div>}>
      <EmbeddedLogsExploration {...props} />
    </Suspense>
  );
}
