import React, { ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { css, cx } from '@emotion/css';
import { useResizeObserver } from '@react-aria/utils';

import { formattedValueToString, getValueFormat, GrafanaTheme2, LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelRenderer } from '@grafana/runtime';
import { AxisPlacement, Column, InteractiveTable, Stack, Text, TooltipDisplayMode, useStyles2 } from '@grafana/ui';

import { Logs } from './Logs';
import type { PatternsProps } from './types';
import type { PatternFrame } from 'Components/ServiceScene/Breakdowns/Patterns/PatternsBreakdownScene';
import { getLevelColor } from 'services/levels';
import { testIds } from 'services/testIds';

interface TableProps extends PatternsProps {
  patterns: PatternFrame[];
  total: number;
}

export function Table({ patterns, total, datasourceUid, query, timeRange }: TableProps) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);
  const [isSmall, setIsSmall] = useState(false);
  const syncSize = () => setIsSmall((ref.current?.getBoundingClientRect().width ?? 0) < 830);

  useLayoutEffect(syncSize, []);
  useResizeObserver({ ref, onResize: syncSize });

  const hasLevels = patterns.some((pattern) => pattern.levels.length > 0);
  const columns = useMemo(() => {
    const renderCount = (row: PatternFrame) => formattedValueToString(getValueFormat('short')(row.sum));
    const renderPercent = (row: PatternFrame) => `${total ? Math.round((100 * row.sum) / total) : 0}%`;
    const renderLevels = (row: PatternFrame) =>
      [...row.levels].sort().map((level) => (
        <span key={level} className={styles.level(level)}>
          {level}
        </span>
      ));
    const renderPattern = (row: PatternFrame) => (
      <div className={styles.pattern} data-testid={testIds.exposedComponents.patterns.card}>
        {row.pattern}
      </div>
    );
    const renderSmallStat = (label: string, content: ReactNode) => (
      <Stack direction="column" gap={0.5} minWidth={0}>
        <Text variant="sm" color="secondary">
          {label}
        </Text>
        <Stack alignItems="center" wrap="wrap" minHeight={3}>
          {content}
        </Stack>
      </Stack>
    );

    if (isSmall) {
      return [
        {
          id: 'pattern',
          header: t('embedded-patterns.pattern-column', 'Pattern'),
          cell: ({
            cell: {
              row: { original: row },
            },
          }) => (
            <Stack direction="column" gap={1} minWidth={0} width="100%">
              {renderPattern(row)}
              <Stack alignItems="flex-end" gap={2} wrap="wrap" minWidth={0}>
                {renderSmallStat(
                  t('embedded-patterns.count-column', 'Count'),
                  <Text variant="sm">{renderCount(row)}</Text>
                )}
                {renderSmallStat(
                  t('embedded-patterns.percent-column', 'Percent'),
                  <Text variant="sm">{renderPercent(row)}</Text>
                )}
                {row.levels.length > 0 &&
                  renderSmallStat(t('embedded-patterns.levels-column', 'Levels'), renderLevels(row))}
              </Stack>
            </Stack>
          ),
        },
      ] satisfies Array<Column<PatternFrame>>;
    }

    const columns: Array<Column<PatternFrame>> = [
      {
        id: 'volume-samples',
        header: '',
        disableGrow: true,
        cell: ({
          cell: {
            row: { original: row },
          },
        }) => (
          <div className={styles.sparkline}>
            <PanelRenderer
              pluginId="timeseries"
              title=""
              width={230}
              height={30}
              timeZone="browser"
              data={{ series: [row.dataFrame], state: LoadingState.Done, timeRange }}
              options={{
                annotations: { multiLane: true },
                legend: { showLegend: false },
                tooltip: { mode: TooltipDisplayMode.None },
              }}
              fieldConfig={{
                defaults: {
                  custom: { axisPlacement: AxisPlacement.Hidden, hideFrom: { legend: true, tooltip: true } },
                },
                overrides: [],
              }}
            />
          </div>
        ),
      },
      {
        id: 'sum',
        header: t('embedded-patterns.count-column', 'Count'),
        sortType: 'number',
        disableGrow: true,
        cell: ({
          cell: {
            row: { original: row },
          },
        }) => <Text variant="sm">{renderCount(row)}</Text>,
      },
      {
        id: 'percent',
        header: '%',
        sortType: (a, b) => a.original.sum - b.original.sum,
        disableGrow: true,
        cell: ({
          cell: {
            row: { original: row },
          },
        }) => <Text variant="sm">{renderPercent(row)}</Text>,
      },
      {
        id: 'pattern',
        header: t('embedded-patterns.pattern-column', 'Pattern'),
        cell: ({
          cell: {
            row: { original: row },
          },
        }) => renderPattern(row),
      },
    ];

    if (hasLevels) {
      columns.splice(1, 0, {
        id: 'levels',
        header: t('embedded-patterns.levels-column', 'Levels'),
        disableGrow: true,
        cell: ({
          cell: {
            row: { original: row },
          },
        }) => renderLevels(row),
      });
    }

    return columns;
  }, [hasLevels, isSmall, styles, timeRange, total]);

  return (
    <div
      ref={ref}
      className={cx(styles.table, isSmall && styles.tableSmall)}
      data-testid={testIds.exposedComponents.patterns.table}
    >
      <InteractiveTable
        columns={columns}
        data={patterns}
        getRowId={(row: PatternFrame) => row.pattern}
        renderExpandedRow={(row) => (
          <Logs datasourceUid={datasourceUid} query={query} timeRange={timeRange} pattern={row.pattern} />
        )}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflowX: 'auto',
    th: { backgroundColor: theme.colors.background.canvas, position: 'sticky', top: 0, zIndex: 1 },
  }),
  tableSmall: css({
    overflow: 'visible',
    table: { tableLayout: 'fixed' },
    thead: { display: 'none' },
    'td:first-child:not([colspan])': { width: theme.spacing(4) },
    th: { position: 'static' },
  }),
  sparkline: css({ width: 230, height: 30, overflow: 'hidden', pointerEvents: 'none' }),
  pattern: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.sm.fontSize,
    minWidth: 0,
    maxWidth: '100%',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  }),
  level: (level: string) => {
    const color = getLevelColor(level, theme) ?? theme.colors.text.secondary;

    return css({
      display: 'inline-block',
      fontSize: theme.typography.sm.fontSize,
      marginRight: theme.spacing(0.5),
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.default,
      backgroundColor: color,
      color: theme.colors.getContrastText(color),
    });
  },
});
