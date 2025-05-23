import React, { lazy, Suspense } from 'react';

import { LinkButton } from '@grafana/ui';

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
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EmbeddedLogsExploration {...props} />
    </Suspense>
  );
}
