import React from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { EmbeddedLogsMiniProps } from './types';

// Scaffold only: built from scratch, does not reuse IndexScene/ServiceScene or any other existing scene.
export default function EmbeddedLogsMini({ embedderName, query }: EmbeddedLogsMiniProps) {
  return (
    <Alert severity="info" title={t('components.embedded-logs-mini.title', 'Embedded Logs Drilldown (mini)')}>
      <Trans i18nKey="components.embedded-logs-mini.not-implemented" values={{ embedderName, query }}>
        Scaffolding only — nothing is rendered here yet. embedderName=&quot;{'{{embedderName}}'}&quot; query=&quot;
        {'{{query}}'}&quot;
      </Trans>
    </Alert>
  );
}
