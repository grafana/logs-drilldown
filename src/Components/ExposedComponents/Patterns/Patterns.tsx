import React, { useEffect, useMemo, useState } from 'react';

import { css } from '@emotion/css';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { toDataQueryError } from '@grafana/runtime';
import { Alert, useStyles2 } from '@grafana/ui';

import { Table } from './Table';
import type { PatternsProps } from './types';
import { Volume } from './Volume';
import { PATTERNS_MAX_AGE_HOURS } from 'Components/ServiceScene/Breakdowns/Patterns/PatternsBreakdownScene';
import {
  PatternsNoMatchingFilters,
  PatternsNotDetected,
  PatternsTooOld,
} from 'Components/ServiceScene/Breakdowns/Patterns/PatternsNotDetected';
import { SearchInput } from 'Components/ServiceScene/Breakdowns/SearchInput';
import { StatusWrapper } from 'Components/ServiceScene/Breakdowns/StatusWrapper';
import { getEmbeddedPatterns, type PatternFrame } from 'services/patterns';
import { testIds } from 'services/testIds';

export default function Patterns({ datasourceUid, query, timeRange, onTimeRangeChange }: PatternsProps) {
  const request = useMemo(() => ({ datasourceUid, query, timeRange }), [datasourceUid, query, timeRange]);

  const [result, setResult] = useState<{ error?: string; patterns: PatternFrame[]; request: typeof request }>();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setResult(undefined);
    getEmbeddedPatterns(datasourceUid, query, timeRange, controller.signal).then(
      (patterns) => {
        if (!controller.signal.aborted) {
          setResult({ request, patterns });
        }
      },
      (error) => {
        if (!controller.signal.aborted) {
          setResult({ request, patterns: [], error: toDataQueryError(error).message });
        }
      }
    );

    return () => controller.abort();
  }, [request, datasourceUid, query, timeRange]);

  const data = result?.request === request ? result : undefined;
  const filtered =
    data?.patterns.filter(({ pattern }) => pattern.toLocaleLowerCase().includes(search.toLocaleLowerCase())) ?? [];
  const total = data?.patterns.reduce((sum, pattern) => sum + pattern.sum, 0) ?? 0;

  const styles = useStyles2(getStyles);

  return (
    <section className={styles.patterns} aria-label={t('embedded-patterns.title', 'Patterns')}>
      <SearchInput
        aria-label={t('embedded-patterns.search', 'Search patterns')}
        value={search}
        data-testid={testIds.exposedComponents.patterns.search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        onClear={() => setSearch('')}
      />
      {data?.error ? (
        <Alert title={t('embedded-patterns.error', 'Unable to load patterns')}>{data.error}</Alert>
      ) : (
        <StatusWrapper isLoading={!data}>
          {!data?.patterns.length ? (
            dateTime().diff(timeRange.to, 'hours') >= PATTERNS_MAX_AGE_HOURS ? (
              <PatternsTooOld />
            ) : (
              <PatternsNotDetected />
            )
          ) : !filtered.length ? (
            <PatternsNoMatchingFilters />
          ) : (
            <>
              <Volume patterns={filtered} range={timeRange} onTimeRangeChange={onTimeRangeChange} />
              <Table
                patterns={filtered}
                total={total}
                datasourceUid={datasourceUid}
                query={query}
                timeRange={timeRange}
              />
            </>
          )}
        </StatusWrapper>
      )}
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  patterns: css({
    width: '100%',
    containerType: 'inline-size',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    padding: theme.spacing(1),
    boxSizing: 'border-box',
    overflow: 'auto',
    '> * + *': { marginTop: theme.spacing(1) },
  }),
});
