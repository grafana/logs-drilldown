import React, { useEffect, useRef, useState } from 'react';

import { css } from '@emotion/css';

import { LoadingState, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelRenderer, toDataQueryError } from '@grafana/runtime';
import { Alert, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import type { PatternsProps } from './types';
import { getPatternLogs } from 'services/patterns';
import { testIds } from 'services/testIds';

export function Logs({ datasourceUid, query, timeRange, pattern }: PatternsProps & { pattern: string }) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getPatternLogs>>>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setResult(undefined);
    setError(undefined);
    getPatternLogs(datasourceUid, query, pattern, timeRange, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          setResult(result);
        }
      },
      (error) => {
        if (!controller.signal.aborted) {
          setError(toDataQueryError(error).message);
        }
      }
    );

    return () => controller.abort();
  }, [datasourceUid, query, pattern, timeRange]);

  return (
    <div ref={ref} className={styles.logs} data-testid={testIds.exposedComponents.patterns.logs}>
      {error ? (
        <Alert title={t('embedded-patterns.logs-error', 'Unable to load pattern logs')}>{error}</Alert>
      ) : !result ? (
        <LoadingPlaceholder text={t('embedded-patterns.logs-loading', 'Loading pattern logs...')} />
      ) : (
        <>
          {result.filtersOmitted && (
            <Alert
              severity="warning"
              title={t('embedded-patterns.logs-filter-warning', 'Showing logs without query filters')}
            >
              {t(
                'embedded-patterns.logs-filter-message',
                'The logs returned by this pattern do not match the current query filters.'
              )}
            </Alert>
          )}
          {!result.series.some((frame) => frame.length > 0) ? (
            <p>{t('embedded-patterns.logs-empty', 'This pattern returns no logs.')}</p>
          ) : width > 0 ? (
            <PanelRenderer
              pluginId="logs"
              title={t('embedded-patterns.logs-title', 'Pattern logs')}
              width={width}
              height={300}
              timeZone="browser"
              data={{ series: result.series, state: LoadingState.Done, timeRange }}
              options={{ showTime: true, wrapLogMessage: true }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  logs: css({
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
    padding: theme.spacing(1),
    boxSizing: 'border-box',
  }),
});
