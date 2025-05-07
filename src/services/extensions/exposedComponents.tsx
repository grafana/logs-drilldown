import React, { lazy, Suspense } from 'react';

import { LinkButton } from '@grafana/ui';

import { OpenInLogsDrilldownButtonProps } from 'Components/OpenInLogsDrilldownButton/types';
const OpenInLogsDrilldownButton = lazy(() => import('Components/OpenInLogsDrilldownButton/OpenInLogsDrilldownButton'));

function SuspendedOpenInLogsDrilldownButton(props: OpenInLogsDrilldownButtonProps) {
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

export const exposedComponents = [
  {
    component: SuspendedOpenInLogsDrilldownButton,
    description: 'A button that opens a logs view in the Logs Drilldown app.',
    id: `grafana-lokiexplore-app/open-in-explore-logs-button/v1`,
    title: 'Open in Logs Drilldown button',
  },
];
