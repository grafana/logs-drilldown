import { SceneComponentProps, SceneFlexLayout, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React from 'react';
import { css, cx } from '@emotion/css';
import { GiveFeedbackButton } from './GiveFeedbackButton';
import { CustomVariableValueSelectors } from './CustomVariableValueSelectors';
import { PatternControls } from './PatternControls';
import { IndexScene } from './IndexScene';
import { CONTROLS_VARS_DATASOURCE, CONTROLS_VARS_FIELDS_COMBINED, LayoutScene } from './LayoutScene';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { AppliedPattern } from '../../services/variables';
import { getOpenInDrilldownURL } from 'services/extensions/links';
import {
  getDataSourceVariable,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
} from '../../services/variableGetters';

type HeaderPosition = 'sticky' | 'relative';
interface VariableLayoutSceneState extends SceneObjectState {
  position: HeaderPosition;
}
export class VariableLayoutScene extends SceneObjectBase<VariableLayoutSceneState> {
  static Component = ({ model }: SceneComponentProps<VariableLayoutScene>) => {
    const indexScene = sceneGraph.getAncestor(model, IndexScene);
    const { controls, patterns } = indexScene.useState();

    // All this re-rendering for embedded only
    const levelsVar = getLevelsVariable(model);
    const fieldsVar = getFieldsVariable(model);
    const labelsVar = getLabelsVariable(model);
    const dataSourceVariable = getDataSourceVariable(model);
    levelsVar.useState();
    fieldsVar.useState();
    labelsVar.useState();

    const layoutScene = sceneGraph.getAncestor(model, LayoutScene);
    const { lineFilterRenderer, levelsRenderer } = layoutScene.useState();

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
                {!indexScene.state.embedded && <GiveFeedbackButton />}
                <div className={styles.timeRangeDatasource}>
                  {indexScene.state.embedded && (
                    <LinkButton
                      href={getOpenInDrilldownURL(dataSourceVariable, labelsVar, fieldsVar, levelsVar)}
                      variant="secondary"
                      icon="arrow-right"
                    >
                      Logs Drilldown
                    </LinkButton>
                  )}

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
    firstRowWrapper: css({
      '& > div > div': {
        gap: '16px',
        label: 'first-row-wrapper',

        [theme.breakpoints.down('lg')]: {
          flexDirection: 'column',
        },
      },
    }),
    controlsFirstRowContainer: css({
      label: 'controls-first-row',
      display: 'flex',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      [theme.breakpoints.down('md')]: {
        flexDirection: 'column-reverse',
      },
    }),
    controlsRowContainer: css({
      '&:empty': {
        display: 'none',
      },
      label: 'controls-row',
      display: 'flex',
      // @todo add custom renderers for all variables, this currently results in 2 "empty" rows that always take up space
      gap: theme.spacing(2),
      alignItems: 'flex-start',
      [theme.breakpoints.down('lg')]: {
        flexDirection: 'column',
      },
    }),
    stickyControlsContainer: css({
      position: 'sticky',
      top: grafanaTopBarHeight,
      left: 0,
      background: theme.colors.background.canvas,
      zIndex: theme.zIndex.navbarFixed,
      gap: theme.spacing(0),
      boxShadow: theme.shadows.z1,
    }),
    controlsContainer: css({
      label: 'controlsContainer',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(2),
    }),
    filters: css({
      label: 'filters',
      display: 'flex',
    }),
    filtersWrap: css({
      label: 'filtersWrap',
      display: 'flex',
      gap: theme.spacing(2),
      width: 'calc(100% - 450)',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
    }),
    controlsWrapper: css({
      label: 'controlsWrapper',
      display: 'flex',
      flexDirection: 'column',
      marginTop: theme.spacing(0.375),
    }),
    timeRangeDatasource: css({
      label: 'timeRangeDatasource',
      display: 'flex',
      gap: theme.spacing(1),
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    }),
    timeRange: css({
      label: 'timeRange',
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
    }),
  };
}
