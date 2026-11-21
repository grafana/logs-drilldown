import React, { useState } from 'react';

import { css } from '@emotion/css';

import { dateTimeParse, PageLayoutType, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService, usePluginComponent } from '@grafana/runtime';
import { EmbeddedScene, SceneAppPage, SceneReactObject } from '@grafana/scenes';
import { Alert, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import type { PatternsProps } from './types';
import { useDefaultDatasourceUid } from 'services/initialDatasourceInfo';
import { prefixRoute } from 'services/plugin';

function ExposedPatternsPage() {
  const styles = useStyles2(getStyles);
  const params = new URLSearchParams(locationService.getLocation().search);
  const explicitUid = params.get('datasourceUid') ?? undefined;
  const { dsUID, isLoading } = useDefaultDatasourceUid(explicitUid);
  const datasourceUid = explicitUid ?? dsUID;

  const { component: Patterns, isLoading: loadingComponent } = usePluginComponent<PatternsProps>(
    'grafana-lokiexplore-app/patterns/v1'
  );

  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const from = dateTimeParse('now-15m');
    const to = dateTimeParse('now');

    return { from, to, raw: { from, to } };
  });

  if (isLoading || loadingComponent) {
    return <LoadingPlaceholder text={t('embedded-patterns.loading', 'Loading...')} />;
  }

  if (!Patterns || !datasourceUid) {
    return <Alert title={t('embedded-patterns.unavailable', 'Patterns component or Loki datasource is unavailable')} />;
  }

  return (
    <div className={styles.exposedPatternsPage}>
      <Patterns
        datasourceUid={datasourceUid}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        query={params.get('query') ?? '{service_name="tempo-distributor"}'}
      />
    </div>
  );
}

export function makeExposedPatternsPage() {
  return new SceneAppPage({
    getScene: () => new EmbeddedScene({ body: new SceneReactObject({ component: ExposedPatternsPage }) }),
    layout: PageLayoutType.Custom,
    routePath: 'patterns',
    url: prefixRoute('patterns'),
    title: t('embedded-patterns.title', 'Patterns'),
  });
}

const getStyles = () => ({
  exposedPatternsPage: css({
    width: '100%',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    overflow: 'auto',
    resize: 'both',
  }),
});
