import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { VizConfigBuilder } from '@grafana/scenes';
import { useQueryRunner, VizPanel } from '@grafana/scenes-react';
import { Options } from '@grafana/schema/dist/esm/raw/composable/logs/panelcfg/x/LogsPanelCfg_types.gen';
import { useStyles2 } from '@grafana/ui';

import { LokiQuery, LokiQueryDirection } from '../../services/lokiQuery';
import { getLogOption } from '../../services/store';
import { DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS } from '../../services/variables';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { getColumnsLabelsExpr, mapColumnsLabelsToAdHocFilters } from './DefaultColumnsLabelsQueries';

interface Props {
  recordIndex: number;
}
export function DefaultColumnsLogsView({ recordIndex }: Props) {
  const { dsUID, localDefaultColumnsState } = useDefaultColumnsContext();

  const record = localDefaultColumnsState?.[dsUID]?.records[recordIndex];
  const labelFilters = mapColumnsLabelsToAdHocFilters(record?.labels ?? []);
  const expr = getColumnsLabelsExpr(labelFilters);
  const query: LokiQuery = {
    refId: `gld-sample-${recordIndex}`,
    expr: `{${expr}} ${DETECTED_FIELDS_MIXED_FORMAT_EXPR_NO_JSON_FIELDS}`,
    maxLines: 100,
    direction: LokiQueryDirection.Scan,
  };

  const dataProvider = useQueryRunner({
    datasource: { uid: dsUID },
    queries: [query],
  });

  const styles = useStyles2(getStyles);

  const logsPanelOptions: Partial<Options> = {
    enableLogDetails: getLogOption('enableLogDetails', false),
    prettifyLogMessage: getLogOption('prettifyLogMessage', false),
    showCommonLabels: getLogOption('showCommonLabels', false),
    showLogContextToggle: getLogOption('showLogContextToggle', false),
    showTime: getLogOption('showTime', false),
    wrapLogMessage: getLogOption('wrapLogMessage', false),
    fontSize: getLogOption('fontSize', 'small'),
    enableInfiniteScrolling: getLogOption('enableInfiniteScrolling', true),
    sortOrder: getLogOption('sortOrder', 'Descending'),
    noInteractions: true,
    showControls: getLogOption('showControls', true),
    displayedFields: record?.columns,
  };

  const viz = new VizConfigBuilder<Options, {}>('logs', '10.0.0', () => logsPanelOptions);
  return (
    <div className={styles.panelWrap}>
      <VizPanel hoverHeader={true} title={''} viz={viz.build()} dataProvider={dataProvider} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panelWrap: css({
    label: 'panelWrap',
    height: '320px',
  }),
});
