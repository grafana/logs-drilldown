import React from 'react';

import { css, cx } from '@emotion/css';

import { getValueFormat, GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { SceneComponentProps, SceneFlexLayout, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';

import { getJsonParserVariableVisibility } from '../../services/store';
import { AppliedPattern } from '../../services/variables';
import { EmbeddedLinkScene } from '../EmbeddedLogsExploration/EmbeddedLinkScene';
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
  embeddedLink?: EmbeddedLinkScene;
  position: HeaderPosition;
}
export class VariableLayoutScene extends SceneObjectBase<VariableLayoutSceneState> {
  constructor(props: VariableLayoutSceneState) {
    super(props);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public onActivate() {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    if (indexScene.state.embedded) {
      this.setState({
        embeddedLink: new EmbeddedLinkScene({}),
      });
    }
  }

  static Component = ({ model }: SceneComponentProps<VariableLayoutScene>) => {
    const indexScene = sceneGraph.getAncestor(model, IndexScene);
    const { controls, patterns } = indexScene.useState();
    const layoutScene = sceneGraph.getAncestor(model, LayoutScene);
    const { levelsRenderer, lineFilterRenderer } = layoutScene.useState();
    const height = useChromeHeaderHeight();
    const styles = useStyles2((theme) => getStyles(theme, height ?? 40));
    const bytesProcessed = getValueFormat('decbytes')(indexScene.state.bytesProcessed ?? 0);

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
                <div className={styles.feedbackWrapper}>
                  <span className={styles.bytesProcessed}>
                    Bytes processed: {bytesProcessed.text} {bytesProcessed.suffix}{' '}
                    <IconButton
                      onClick={() => indexScene.setState({ bytesProcessed: 0 })}
                      tooltip={'Reset bytes processed'}
                      name={'times'}
                      size={'xs'}
                      variant={'secondary'}
                    />
                  </span>
                  {!indexScene.state.embedded && <GiveFeedbackButton />}
                </div>
                <div className={styles.timeRangeDatasource}>
                  {model.state.embeddedLink && <model.state.embeddedLink.Component model={model.state.embeddedLink} />}

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

function getStyles(theme: GrafanaTheme2, height: number) {
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
    bytesProcessed: css({
      display: 'flex',
      gap: theme.spacing(1),
      position: 'relative',
      top: theme.spacing(-1),
    }),
    feedbackWrapper: css({
      fontSize: theme.typography.bodySmall.fontSize,
      display: 'flex',
      justifyContent: 'space-between',
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
      top: height,
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
