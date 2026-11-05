import React from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { EmbeddedLogsMiniProps } from './types';

// Scaffold only: built from scratch, does not reuse IndexScene/ServiceScene or any other existing scene.
export default function EmbeddedLogsMini({
  datasourceUid,
  embedderName,
  query,
  referenceQuery,
  timeRange,
}: EmbeddedLogsMiniProps) {
  return (
    <Alert severity="info" title={t('components.embedded-logs-mini.title', 'Embedded Logs Drilldown (mini)')}>
      <Trans
        i18nKey="components.embedded-logs-mini.not-implemented"
        values={{
          datasourceUid,
          embedderName,
          query,
          referenceQuery: referenceQuery ?? '(none)',
          timeRange: timeRange ? `${timeRange.raw.from}–${timeRange.raw.to}` : '(default)',
        }}
      >
        Scaffolding only — nothing is rendered here yet. embedderName=&quot;{'{{embedderName}}'}&quot;
        datasourceUid=&quot;{'{{datasourceUid}}'}&quot; query=&quot;{'{{query}}'}&quot; referenceQuery=&quot;
        {'{{referenceQuery}}'}&quot; timeRange=&quot;{'{{timeRange}}'}&quot;
      </Trans>
    </Alert>
  );
}
