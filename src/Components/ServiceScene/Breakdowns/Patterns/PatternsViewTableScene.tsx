import React from 'react';

import { css, cx } from '@emotion/css';
import { CellProps } from 'react-table';

import { DataFrame, GrafanaTheme2, LoadingState, PanelData, scaledUnits } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { AxisPlacement, Column, InteractiveTable, TooltipDisplayMode, useTheme2 } from '@grafana/ui';

import { LINE_LIMIT } from '../../../../services/query';
import { testIds } from '../../../../services/testIds';
import { AppliedPattern } from '../../../../services/variables';
import { FilterButton } from '../../../FilterButton';
import { IndexScene } from '../../../IndexScene/IndexScene';
import { onPatternClick } from './FilterByPatternsButton';
import { PatternNameLabel } from './PatternNameLabel';
import { PatternFrame, PatternsBreakdownScene } from './PatternsBreakdownScene';
import { PatternsFrameScene } from './PatternsFrameScene';
import { PatternsTableExpandedRow } from './PatternsTableExpandedRow';
import { getExplorationFor } from 'services/scenes';

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
  pattern: string;
  sum: number;
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
   * @param total
   * @param appliedPatterns
   * @param theme
   * @param patternsNotMatchingFilters
   * @protected
   */
  public buildColumns(
    total: number,
    appliedPatterns: AppliedPattern[] | undefined,
    theme: GrafanaTheme2,
    maxLines: number,
    patternsNotMatchingFilters?: string[]
  ) {
    const styles = getColumnStyles(theme);
    const timeRange = sceneGraph.getTimeRange(this).state.value;
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
        cell: (props) => {
          const value = scaledUnits(1000, SCALED_UNITS)(props.cell.row.original.sum);
          return (
            <div className={styles.countTextWrap}>
              <div>
                {value.prefix ?? ''}
                {value.text}
                {value.suffix ?? ''}
              </div>
            </div>
          );
        },
        header: 'Count',
        id: 'count',
        sortType: 'number',
      },
      {
        cell: (props) => (
          <div className={styles.countTextWrap}>
            <div>{((100 * props.cell.row.original.sum) / total).toFixed(0)}%</div>
          </div>
        ),
        header: '%',
        id: 'percent',
        sortType: 'number',
      },
      {
        cell: (props: CellProps<PatternsTableCellData>) => {
          return (
            <div className={cx(getTablePatternTextStyles(), styles.tablePatternTextDefault)}>
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
        cell: (props: CellProps<PatternsTableCellData>) => {
          if (patternsNotMatchingFilters?.includes(props.cell.row.original.pattern)) {
            return undefined;
          }

          const existingPattern = appliedPatterns?.find(
            (appliedPattern) => appliedPattern.pattern === props.cell.row.original.pattern
          );
          const isIncluded = existingPattern?.type === 'include';
          const isExcluded = existingPattern?.type === 'exclude';
          return (
            <FilterButton
              isExcluded={isExcluded}
              isIncluded={isIncluded}
              onInclude={() => props.cell.row.original.includeLink()}
              onExclude={() => props.cell.row.original.excludeLink()}
              onClear={() => props.cell.row.original.undoLink()}
              buttonFill={'outline'}
            />
          );
        },
        disableGrow: true,
        header: undefined,
        id: 'include',
      },
    ];
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
          pattern: pattern.pattern,
          sum: pattern.sum,
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

const theme = config.theme2;

const getTablePatternTextStyles = () => {
  return css({
    fontFamily: theme.typography.fontFamilyMonospace,
    minWidth: '200px',
    overflow: 'hidden',
    overflowWrap: 'break-word',
  });
};

const getTableStyles = (theme: GrafanaTheme2) => {
  return {
    link: css({
      textDecoration: 'underline',
    }),
    tableWrap: css({
      // Override interactive table style
      '> div': {
        // Need to define explicit height for overflowX
        height: 'calc(100vh - 450px)',
        minHeight: '470px',
      },
      // Make table headers sticky
      th: {
        backgroundColor: theme.colors.background.canvas,
        position: 'sticky',
        top: 0,
        zIndex: theme.zIndex.navbarFixed,
      },
    }),
  };
};
const getColumnStyles = (theme: GrafanaTheme2) => {
  return {
    countTextWrap: css({
      fontSize: theme.typography.bodySmall.fontSize,
      textAlign: 'right',
    }),
    tablePatternTextDefault: css({
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

  // Get state from parent
  const patternsFrameScene = sceneGraph.getAncestor(model, PatternsFrameScene);
  const { legendSyncPatterns } = patternsFrameScene.useState();

  // Must use local patternFrames as the parent decides if we get the filtered or not
  const { patternFrames: patternFramesRaw, patternsNotMatchingFilters } = model.useState();
  const patternFrames = patternFramesRaw ?? [];

  // Get unfiltered patterns for percentage calculation
  const patternsBreakdownScene = sceneGraph.getAncestor(model, PatternsBreakdownScene);
  const unfilteredPatterns = patternsBreakdownScene.state.patternFrames ?? [];

  // Calculate total for percentages
  const total = unfilteredPatterns.reduce((previousValue, frame) => {
    return previousValue + frame.sum;
  }, 0);

  const tableData = model.buildTableData(patternFrames, legendSyncPatterns);
  const columns = model.buildColumns(
    total,
    appliedPatterns,
    theme,
    model.state.maxLines ?? LINE_LIMIT,
    patternsNotMatchingFilters
  );

  return (
    <div data-testid={testIds.patterns.tableWrapper} className={styles.tableWrap}>
      <InteractiveTable
        columns={columns}
        data={tableData}
        getRowId={(r: PatternsTableCellData) => r.pattern}
        renderExpandedRow={(row) => <PatternsTableExpandedRow tableViz={model} row={row} />}
      />
    </div>
  );
}
