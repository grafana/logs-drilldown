import React from 'react';

import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneFlexLayout, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { getJsonParserVariableVisibility } from '../../services/store';
import { AppliedPattern } from '../../services/variables';
import { CustomVariableValueSelectors } from './CustomVariableValueSelectors';
import { GiveFeedbackButton } from './GiveFeedbackButton';
import { IndexScene } from './IndexScene';
import {
  CONTROLS_JSON_FIELDS,
  CONTROLS_VARS_DATASOURCE,
  CONTROLS_VARS_FIELDS_COMBINED,
  LayoutScene,
} from './LayoutScene';
import { PatternControls } from './PatternControls';

type HeaderPosition = 'relative' | 'sticky';
interface VariableLayoutSceneState extends SceneObjectState {
  position: HeaderPosition;
}
export class VariableLayoutScene extends SceneObjectBase<VariableLayoutSceneState> {
  static Component = ({ model }: SceneComponentProps<VariableLayoutScene>) => {
    const indexScene = sceneGraph.getAncestor(model, IndexScene);
    const { controls, patterns } = indexScene.useState();

    const layoutScene = sceneGraph.getAncestor(model, LayoutScene);
    const { levelsRenderer, lineFilterRenderer } = layoutScene.useState();

    const styles = useStyles2((theme) => getStyles(theme, model.state.position));

    return (
      <div
        className={cx(
          styles.controlsContainer,
          model.state.position === 'sticky' ? styles.stickyControlsContainer : undefined
        )}
      >
        <>
          {/* First row - datasource, timepicker, refresh, labels, button */}
          {controls && (
            <div className={styles.controlsFirstRowContainer}>
              <div className={styles.filtersWrap}>
                <div className={cx(styles.filters, styles.firstRowWrapper)}>
                  {controls.map((control) => {
                    return control instanceof SceneFlexLayout ? (
                      <control.Component key={control.state.key} model={control} />
                    ) : null;
                  })}
                </div>
              </div>
              <div className={styles.controlsWrapper}>
                <GiveFeedbackButton />
                <div className={styles.timeRangeDatasource}>
                  {controls.map((control) => {
                    return control.state.key === CONTROLS_VARS_DATASOURCE ? (
                      <control.Component key={control.state.key} model={control} />
                    ) : null;
                  })}

                  <div className={styles.timeRange}>
                    {controls.map((control) => {
                      return !(control instanceof CustomVariableValueSelectors) &&
                        !(control instanceof SceneFlexLayout) ? (
                        <control.Component key={control.state.key} model={control} />
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2nd row - Combined fields (fields + metadata) + Levels - custom renderer */}
          <div className={styles.controlsRowContainer}>
            {levelsRenderer && <levelsRenderer.Component model={levelsRenderer} />}
            {controls && (
              <div className={styles.filtersWrap}>
                <div className={styles.filters}>
                  {controls.map((control) => {
                    return control instanceof CustomVariableValueSelectors &&
                      control.state.key === CONTROLS_VARS_FIELDS_COMBINED ? (
                      <control.Component key={control.state.key} model={control} />
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* JSON parser props and line filter vars are only visible with a local storage debug flag */}
          {getJsonParserVariableVisibility() && (
            <div className={styles.controlsRowContainer}>
              {controls && (
                <div className={styles.filtersWrap}>
                  <div className={styles.filters}>
                    {controls.map((control) => {
                      return control instanceof CustomVariableValueSelectors &&
                        control.state.key === CONTROLS_JSON_FIELDS ? (
                        <control.Component key={control.state.key} model={control} />
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3rd row - Patterns */}
          <div className={styles.controlsRowContainer}>
            <PatternControls
              patterns={patterns}
              onRemove={(patterns: AppliedPattern[]) => indexScene.setState({ patterns })}
            />
          </div>

          {/* 4th row - Line filters - custom renderer */}
          <div className={styles.controlsRowContainer}>
            {lineFilterRenderer && <lineFilterRenderer.Component model={lineFilterRenderer} />}
          </div>
        </>
      </div>
    );
  };
}

// @todo remove hardcoded height: https://github.com/grafana/grafana/issues/103795
const grafanaTopBarHeight = 40;
function getStyles(theme: GrafanaTheme2, position: HeaderPosition) {
  return {
    controlsContainer: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      label: 'controlsContainer',
      padding: theme.spacing(2),
    }),
    controlsFirstRowContainer: css({
      [theme.breakpoints.down('md')]: {
        flexDirection: 'column-reverse',
      },
      alignItems: 'flex-start',
      display: 'flex',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      label: 'controls-first-row',
    }),
    controlsRowContainer: css({
      [theme.breakpoints.down('lg')]: {
        flexDirection: 'column',
      },
      '&:empty': {
        display: 'none',
      },
      alignItems: 'flex-start',
      display: 'flex',
      // @todo add custom renderers for all variables, this currently results in 2 "empty" rows that always take up space
      gap: theme.spacing(2),
      label: 'controls-row',
    }),
    controlsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      label: 'controlsWrapper',
      marginTop: theme.spacing(0.375),
    }),
    filters: css({
      display: 'flex',
      label: 'filters',
    }),
    filtersWrap: css({
      alignItems: 'flex-end',
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(2),
      label: 'filtersWrap',
      width: 'calc(100% - 450)',
    }),
    firstRowWrapper: css({
      '& > div > div': {
        [theme.breakpoints.down('lg')]: {
          flexDirection: 'column',
        },
        gap: '16px',

        label: 'first-row-wrapper',
      },
    }),
    stickyControlsContainer: css({
      background: theme.colors.background.canvas,
      boxShadow: theme.shadows.z1,
      gap: theme.spacing(0),
      left: 0,
      position: 'sticky',
      top: grafanaTopBarHeight,
      zIndex: theme.zIndex.navbarFixed,
    }),
    timeRange: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
      label: 'timeRange',
    }),
    timeRangeDatasource: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      justifyContent: 'flex-end',
      label: 'timeRangeDatasource',
    }),
  };
}
