import React, { lazy, Suspense } from 'react';

import { LinkButton } from '@grafana/ui';

import { EmbeddedLogsExplorationProps } from 'Components/EmbeddedLogsExploration/types';
import { OpenInLogsDrilldownButtonProps } from 'Components/OpenInLogsDrilldownButton/types';
const OpenInLogsDrilldownButton = lazy(() => import('Components/OpenInLogsDrilldownButton/OpenInLogsDrilldownButton'));
const EmbeddedLogsExploration = lazy(() => import('Components/EmbeddedLogsExploration/EmbeddedLogs'));
const MiniEmbeddedLogsExploration = lazy(() => import('Components/MiniEmbeddedLogsExploration/EmbeddedLogs'));

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

export function SuspendedMiniEmbeddedLogsExploration(props: EmbeddedLogsExplorationProps) {
  return (
    <Suspense fallback={<div>Loading Logs Drilldown...</div>}>
      <MiniEmbeddedLogsExploration {...props} />
    </Suspense>
  );
}
