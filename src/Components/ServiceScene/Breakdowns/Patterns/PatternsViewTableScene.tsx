import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { css, cx } from '@emotion/css';
import { useResizeObserver } from '@react-aria/utils';
import { CellProps } from 'react-table';

import { DataFrame, GrafanaTheme2, LoadingState, PanelData, scaledUnits } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AdHocFilterWithLabels,
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import {
  AxisPlacement,
  Column,
  InteractiveTable,
  TooltipDisplayMode,
  useTheme2,
  Button,
  EmptyState,
  Stack,
  Text,
} from '@grafana/ui';

import { onPatternClick } from './FilterByPatternsButton';
import { PatternNameLabel } from './PatternNameLabel';
import { PatternFrame, PatternsBreakdownScene } from './PatternsBreakdownScene';
import { PatternsFrameScene } from './PatternsFrameScene';
import { PatternsTableExpandedRow } from './PatternsTableExpandedRow';
import { FilterButton } from 'Components/FilterButton';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { addToFilters } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { getLevelColor } from 'services/levels';
import { isOperatorInclusive } from 'services/operatorHelpers';
import { LINE_LIMIT } from 'services/query';
import { getExplorationFor } from 'services/scenes';
import { testIds } from 'services/testIds';
import { getLevelsVariable } from 'services/variableGetters';
import { AppliedPattern, LEVEL_VARIABLE_VALUE, VAR_LEVELS } from 'services/variables';

// copied from from grafana repository packages/grafana-data/src/valueFormats/categories.ts
// that is used in Grafana codebase for "short" units
const SCALED_UNITS = ['', ' K', ' Mil', ' Bil', ' Tri', ' Quadr', ' Quint', ' Sext', ' Sept'];
export interface SingleViewTableSceneState extends SceneObjectState {
  expandedRows?: SceneObject[];
  maxLines?: number;

  // The local copy of the pattern frames, the parent breakdown scene decides if we get the filtered subset or not, in this scene we just present the data
  patternFrames: PatternFrame[] | undefined;
  // An array of patterns to exclude links
  patternsNotMatchingFilters?: string[];
}

export interface PatternsTableCellData {
  dataFrame: DataFrame;
  excludeLink: () => void;
  includeLink: () => void;
  levels: string[];
  pattern: string;
  sum: number;
  togglePatternLevel: (level: string) => void;
  undoLink: () => void;
}

export class PatternsViewTableScene extends SceneObjectBase<SingleViewTableSceneState> {
  constructor(state: SingleViewTableSceneState) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }
  onActivate() {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    const maxLines = indexScene.state.ds?.maxLines;
    this.setState({ maxLines });
  }

  public static Component = PatternTableViewSceneComponent;

  /**
   * Build columns for interactive table (wrapper for react-table v7)
   */
  public buildColumns(
    total: number,
    appliedPatterns: AppliedPattern[] | undefined,
    theme: GrafanaTheme2,
    maxLines: number,
    patternFrames: PatternFrame[],
    patternsNotMatchingFilters: string[] | undefined,
    filters: AdHocFilterWithLabels[],
    isSmallViewport = false
  ) {
    const styles = getColumnStyles(theme);
    const timeRange = sceneGraph.getTimeRange(this).state.value;

    const renderCount = (row: PatternsTableCellData) => {
      const value = scaledUnits(1000, SCALED_UNITS)(row.sum);
      return `${value.prefix ?? ''}${value.text}${value.suffix ?? ''}`;
    };
    const renderPercent = (row: PatternsTableCellData) => `${((100 * row.sum) / total).toFixed(0)}%`;
    const renderLevels = (row: PatternsTableCellData) => {
      return [...row.levels].sort().map((level) => {
        const isSelected = filters.some((filter) => isOperatorInclusive(filter.operator) && filter.value === level);
        const levelColor = getLevelColor(level, theme);
        return (
          <Button
            key={level}
            size={'sm'}
            variant={isSelected ? 'primary' : 'secondary'}
            fill={'outline'}
            className={cx(styles.levelWrap, levelColor && getLevelStyles(theme, levelColor, isSelected))}
            onClick={() => {
              row.togglePatternLevel(level);
            }}
          >
            {level}
          </Button>
        );
      });
    };
    const renderFilterButton = (row: PatternsTableCellData) => {
      if (patternsNotMatchingFilters?.includes(row.pattern)) {
        return undefined;
      }

      const existingPattern = appliedPatterns?.find((appliedPattern) => appliedPattern.pattern === row.pattern);
      const isIncluded = existingPattern?.type === 'include';
      const isExcluded = existingPattern?.type === 'exclude';
      return (
        <FilterButton
          isExcluded={isExcluded}
          isIncluded={isIncluded}
          onInclude={() => row.includeLink()}
          onExclude={() => row.excludeLink()}
          onClear={() => row.undoLink()}
          buttonFill={'outline'}
        />
      );
    };

    // The table headers are hidden when small, so each stat carries its own caption
    const renderSmallStat = (label: string, content: React.ReactNode) => (
      <Stack direction="column" gap={0.5} minWidth={0}>
        <Text variant="bodySmall" color="secondary">
          {label}
        </Text>
        <Stack alignItems="center" wrap="wrap" minHeight={3}>
          {content}
        </Stack>
      </Stack>
    );

    // When the wide columns don't fit, each row stacks pattern, stats and actions in one cell
    if (isSmallViewport) {
      return [
        {
          cell: (props: CellProps<PatternsTableCellData>) => {
            const row = props.cell.row.original;
            return (
              <div data-testid={testIds.patterns.smallCell}>
                <Stack direction="column" gap={1} minWidth={0} width="100%">
                  <div className={styles.tablePatternText}>
                    <PatternNameLabel exploration={getExplorationFor(this)} pattern={row.pattern} maxLines={maxLines} />
                  </div>
                  <Stack alignItems="flex-end" justifyContent="space-between" wrap="wrap">
                    <Stack alignItems="flex-end" gap={2} wrap="wrap" minWidth={0}>
                      {renderSmallStat(
                        t(
                          'components.service-scene.breakdowns.patterns.patterns-view-table-scene.count-label',
                          'Count'
                        ),
                        <Text variant="bodySmall">{renderCount(row)}</Text>
                      )}
                      {renderSmallStat(
                        t(
                          'components.service-scene.breakdowns.patterns.patterns-view-table-scene.percent-label',
                          'Percent'
                        ),
                        <Text variant="bodySmall">{renderPercent(row)}</Text>
                      )}
                      {row.levels.length > 0 &&
                        renderSmallStat(
                          t(
                            'components.service-scene.breakdowns.patterns.patterns-view-table-scene.levels-label',
                            'Levels'
                          ),
                          renderLevels(row)
                        )}
                    </Stack>
                    {renderFilterButton(row)}
                  </Stack>
                </Stack>
              </div>
            );
          },
          header: 'Pattern',
          id: 'pattern',
        },
      ];
    }

    const columns: Array<Column<PatternsTableCellData>> = [
      {
        cell: (props: CellProps<PatternsTableCellData>) => {
          const panelData: PanelData = {
            series: [props.cell.row.original.dataFrame],
            state: LoadingState.Done,
            timeRange: timeRange,
          };
          const dataNode = new SceneDataNode({
            data: panelData,
          });

          const timeSeries = PanelBuilders.timeseries()
            .setData(dataNode)
            .setOption('annotations', { multiLane: true })
            .setHoverHeader(true)
            .setOption('tooltip', {
              mode: TooltipDisplayMode.None,
            })
            .setCustomFieldConfig('hideFrom', {
              legend: true,
              tooltip: true,
            })
            .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
            .setDisplayMode('transparent')
            .build();

          return (
            <div className={styles.tableTimeSeriesWrap}>
              <div className={styles.tableTimeSeries}>
                <timeSeries.Component model={timeSeries} />
              </div>
            </div>
          );
        },
        header: '',
        id: 'volume-samples',
      },
      {
        cell: (props) => (
          <div className={styles.countTextWrap}>
            <div>{renderCount(props.cell.row.original)}</div>
          </div>
        ),
        header: 'Count',
        id: 'count',
        sortType: 'number',
      },
      {
        cell: (props) => (
          <div className={styles.countTextWrap}>
            <div>{renderPercent(props.cell.row.original)}</div>
          </div>
        ),
        header: '%',
        id: 'percent',
        sortType: 'number',
      },
      {
        cell: (props: CellProps<PatternsTableCellData>) => {
          return (
            <div className={styles.tablePatternText}>
              <PatternNameLabel
                exploration={getExplorationFor(this)}
                pattern={props.cell.row.original.pattern}
                maxLines={maxLines}
              />
            </div>
          );
        },
        header: 'Pattern',
        id: 'pattern',
      },
      {
        cell: (props: CellProps<PatternsTableCellData>) => renderFilterButton(props.cell.row.original),
        disableGrow: true,
        header: undefined,
        id: 'include',
      },
    ];

    if (patternFrames.some((pattern) => pattern.levels.length > 0)) {
      columns.splice(1, 0, {
        header: 'Levels',
        id: 'levels',
        cell: (props: CellProps<PatternsTableCellData>) => renderLevels(props.cell.row.original),
      });
    }

    return columns;
  }

  /**
   * Filter visible patterns in table, and return cell data for InteractiveTable
   * @param patternFrames
   * @param legendSyncPatterns
   * @private
   */
  public buildTableData(patternFrames: PatternFrame[], legendSyncPatterns: Set<string>): PatternsTableCellData[] {
    const logExploration = sceneGraph.getAncestor(this, IndexScene);
    return patternFrames
      .filter((patternFrame) => {
        return legendSyncPatterns.size ? legendSyncPatterns.has(patternFrame.pattern) : true;
      })
      .map((pattern: PatternFrame) => {
        return {
          dataFrame: pattern.dataFrame,
          excludeLink: () =>
            onPatternClick({
              indexScene: logExploration,
              pattern: pattern.pattern,
              type: 'exclude',
            }),
          includeLink: () =>
            onPatternClick({
              indexScene: logExploration,
              pattern: pattern.pattern,
              type: 'include',
            }),
          togglePatternLevel: (level: string) => {
            addToFilters(LEVEL_VARIABLE_VALUE, level, 'toggle', logExploration, VAR_LEVELS);
          },
          pattern: pattern.pattern,
          sum: pattern.sum,
          levels: pattern.levels,
          undoLink: () =>
            onPatternClick({
              indexScene: logExploration,
              pattern: pattern.pattern,
              type: 'undo',
            }),
        };
      });
  }
}

// Small guard only — a large floor pushes the wrapper past the viewport bottom on short windows,
// stacking a page scrollbar on top of the table's own.
const PATTERNS_TABLE_MIN_HEIGHT = '200px';

// Width the multi-column table needs; narrower containers get the stacked rows instead
const PATTERNS_TABLE_MIN_WIDTH = 830;

const getTableStyles = (theme: GrafanaTheme2) => {
  return {
    link: css({
      textDecoration: 'underline',
    }),
    tableWrap: css({
      // Override interactive table style
      '> div': {
        height: '100%',
      },
      // Lets the wrapper shrink below the table's width instead of stretching the whole tab
      maxWidth: '100%',
      minHeight: PATTERNS_TABLE_MIN_HEIGHT,
      minWidth: 0,
      overflowX: 'auto',
      overflowY: 'hidden',
      // Make table headers sticky
      th: {
        backgroundColor: theme.colors.background.canvas,
        position: 'sticky',
        top: 0,
        zIndex: 1,
      },
    }),
    // Small tables grow with their rows and the page scrolls, not the table
    tableWrapSmall: css({
      minHeight: 0,
      overflow: 'visible',
      th: {
        position: 'static',
      },
    }),
  };
};
// Filled with the level color to match the log line pills. Selected levels add a ring, since the
// fill is no longer available to signal the active filter.
const getLevelStyles = (theme: GrafanaTheme2, levelColor: string, isSelected: boolean) =>
  css({
    '&:hover': {
      backgroundColor: levelColor,
      borderColor: levelColor,
      color: theme.colors.getContrastText(levelColor),
    },
    backgroundColor: levelColor,
    borderColor: levelColor,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.getContrastText(levelColor),
    ...(isSelected && {
      outline: `2px solid ${theme.colors.text.primary}`,
      outlineOffset: '1px',
    }),
  });

const getColumnStyles = (theme: GrafanaTheme2) => {
  return {
    levelWrap: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      '&:not(:last-child)': {
        marginRight: theme.spacing(0.5),
      },
    }),
    countTextWrap: css({
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    tablePatternText: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      maxWidth: '100%',
      minWidth: '200px',
      overflow: 'hidden',
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
    }),
    tableTimeSeries: css({
      height: '30px',
      overflow: 'hidden',
    }),
    tableTimeSeriesWrap: css({
      pointerEvents: 'none',
      width: '230px',
    }),
  };
};

export function PatternTableViewSceneComponent({ model }: SceneComponentProps<PatternsViewTableScene>) {
  const indexScene = sceneGraph.getAncestor(model, IndexScene);
  const { patterns: appliedPatterns } = indexScene.useState();
  const theme = useTheme2();
  const styles = getTableStyles(theme);

  // Fill the viewport below the table's rendered position (same approach as LogsListScene), so the
  // visible row count adapts to the screen instead of a fixed height.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<string | undefined>(undefined);
  // Based on the space the table actually gets, so docked menus and embedded views count too
  const [isSmallViewport, setIsSmallViewport] = useState(false);
  const syncSize = () => {
    if (!wrapperRef.current) {
      return;
    }
    const dimensions = wrapperRef.current.getBoundingClientRect();
    if (dimensions.height === 0) {
      return;
    }
    const isSmall = dimensions.width < PATTERNS_TABLE_MIN_WIDTH;
    setIsSmallViewport(isSmall);
    // Small tables grow with their rows, so they get no fixed height
    const offset = dimensions.y + window.scrollY;
    setHeight(isSmall ? undefined : `calc(100vh - ${offset + 16}px)`);
  };
  useLayoutEffect(syncSize);
  useResizeObserver({ onResize: syncSize, ref: wrapperRef });

  const tableWrapClassNames = cx(styles.tableWrap, isSmallViewport && styles.tableWrapSmall);

  // Get state from parent
  const patternsFrameScene = sceneGraph.getAncestor(model, PatternsFrameScene);
  const { legendSyncPatterns } = patternsFrameScene.useState();

  // Must use local patternFrames as the parent decides if we get the filtered or not
  const { patternFrames = [], patternsNotMatchingFilters } = model.useState();
  const levelsVar = getLevelsVariable(model);
  const { filters } = levelsVar.useState();

  // Get unfiltered patterns for percentage calculation
  const patternsBreakdownScene = sceneGraph.getAncestor(model, PatternsBreakdownScene);
  const unfilteredPatterns = patternsBreakdownScene.state.patternFrames ?? [];

  // Calculate total for percentages
  const total = unfilteredPatterns.reduce((previousValue, frame) => {
    return previousValue + frame.sum;
  }, 0);

  const tableData = useMemo(
    () => model.buildTableData(patternFrames, legendSyncPatterns),
    [legendSyncPatterns, model, patternFrames]
  );
  const columns = useMemo(
    () =>
      model.buildColumns(
        total,
        appliedPatterns,
        theme,
        model.state.maxLines ?? LINE_LIMIT,
        patternFrames,
        patternsNotMatchingFilters,
        filters,
        isSmallViewport
      ),
    [appliedPatterns, filters, isSmallViewport, model, patternFrames, patternsNotMatchingFilters, theme, total]
  );

  if (patternFrames.length === 0) {
    return (
      <div
        ref={wrapperRef}
        style={{ height }}
        data-testid={testIds.patterns.tableWrapper}
        className={tableWrapClassNames}
      >
        <EmptyState
          message={t(
            'components.service-scene.breakdowns.patterns.patterns-view-table-scene.no-patterns-title',
            'No patterns to display'
          )}
          variant="not-found"
        >
          {filters.length > 0
            ? t(
                'components.service-scene.breakdowns.patterns.patterns-view-table-scene.no-filtered-patterns-message',
                'No patterns found in the current time range or matching the current level filters.'
              )
            : t(
                'components.service-scene.breakdowns.patterns.patterns-view-table-scene.no-patterns-message',
                'No patterns found in the current time range.'
              )}
        </EmptyState>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={{ height }}
      data-testid={testIds.patterns.tableWrapper}
      className={tableWrapClassNames}
    >
      <InteractiveTable
        columns={columns}
        data={tableData}
        getRowId={(r: PatternsTableCellData) => r.pattern}
        renderExpandedRow={(row) => <PatternsTableExpandedRow tableViz={model} row={row} />}
      />
    </div>
  );
}
