import React, { useEffect, useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { EmbeddedLogsMiniScene } from './EmbeddedLogsMiniScene';
import { EmbeddedLogsMiniProps } from './types';

// Scaffold only: built from scratch, does not reuse IndexScene/ServiceScene or any other existing scene.
// Renders raw query-runner state so the data layer can be verified before any real UI is built on top of it.
export default function EmbeddedLogsMini({
  datasourceUid,
  embedderName,
  query,
  referenceQuery,
  timeRange,
}: EmbeddedLogsMiniProps) {
  const scene = useMemo(
    () => new EmbeddedLogsMiniScene({ datasourceUid, query, timeRange }),
    [datasourceUid, query, timeRange]
  );

  useEffect(() => scene.activate(), [scene]);

  const { data: logsData } = scene.state.logsQueryRunner.useState();
  const { data: volumeData } = scene.state.volumeQueryRunner.useState();
  const logsRowCount = logsData?.series.reduce((sum, frame) => sum + frame.length, 0) ?? 0;

  return (
    <Alert severity="info" title={t('components.embedded-logs-mini.title', 'Embedded Logs Drilldown (mini)')}>
      <div>
        <Trans
          i18nKey="components.embedded-logs-mini.props-debug"
          values={{ datasourceUid, embedderName, query, referenceQuery: referenceQuery ?? '(none)' }}
        >
          embedderName=&quot;{'{{embedderName}}'}&quot; datasourceUid=&quot;{'{{datasourceUid}}'}&quot; query=&quot;
          {'{{query}}'}&quot; referenceQuery=&quot;{'{{referenceQuery}}'}&quot;
        </Trans>
      </div>
      <div>
        <Trans
          i18nKey="components.embedded-logs-mini.logs-query-debug"
          values={{ rows: logsRowCount, state: logsData?.state ?? 'NotStarted' }}
        >
          Logs query runner: state={'{{state}}'} rows={'{{rows}}'}
        </Trans>
      </div>
      <div>
        <Trans
          i18nKey="components.embedded-logs-mini.volume-query-debug"
          values={{ series: volumeData?.series.length ?? 0, state: volumeData?.state ?? 'NotStarted' }}
        >
          Volume query runner: state={'{{state}}'} series={'{{series}}'}
        </Trans>
      </div>
    </Alert>
  );
}
