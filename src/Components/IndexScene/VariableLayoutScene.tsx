import React from 'react';

import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction, useChromeHeaderHeight } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
} from '@grafana/scenes';
import { ToolbarButton, useStyles2 } from '@grafana/ui';

import { syncLogsListPanelHeightFromScene } from '../../services/scenes';
import {
  getCollapsibleFiltersState,
  getJsonParserVariableVisibility,
  setCollapsibleFiltersState,
} from '../../services/store';
import { AppliedPattern, VAR_JSON_PARSER, VAR_LOGFMT_PARSER } from '../../services/variables';
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
import { ResetFiltersButton } from './ResetFiltersButton';
import { reportAppInteraction, USER_EVENTS_PAGES, USER_EVENTS_ACTIONS } from 'services/analytics';
import { CustomConstantVariable } from 'services/CustomConstantVariable';
import { PageSlugs } from 'services/enums';
import {
  getJsonParserSegment,
  getLogfmtParserSegment,
  getParserEnabled,
  setParserEnabled,
} from 'services/parserToggle';
import { getDrilldownSlug } from 'services/routing';
import { testIds } from 'services/testIds';

type HeaderPosition = 'relative' | 'sticky';
interface VariableLayoutSceneState extends SceneObjectState {
  collapsed?: boolean;
  embeddedLink?: EmbeddedLinkScene;
  parsersEnabled?: boolean;
  position: HeaderPosition;
}
export class VariableLayoutScene extends SceneObjectBase<VariableLayoutSceneState> {
  constructor(props: VariableLayoutSceneState) {
    const collapsed = getCollapsibleFiltersState();

    super({
      ...props,
      collapsed,
      parsersEnabled: getParserEnabled(),
    });

    this.addActivationHandler(this.onActivate.bind(this));

    reportInteraction('grafana_logs_app_filters_collapse_state', {
      collapsed,
    });
  }

  public onActivate() {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    if (indexScene.state.embedded) {
      this.setState({
        embeddedLink: new EmbeddedLinkScene({}),
      });
    }
  }

  public toggleCollapsedState = () => {
    const collapsed = !this.state.collapsed;
    this.setState({
      collapsed,
    });
    setCollapsibleFiltersState(collapsed);
    reportInteraction('grafana_logs_app_filters_collapse_toggled', {
      collapsed,
    });
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    const contentScene = indexScene.state.contentScene;
    if (contentScene) {
      syncLogsListPanelHeightFromScene(contentScene);
    }
  };

  public toggleParser = () => {
    const parsersEnabled = !this.state.parsersEnabled;

    reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.parsers_toggled, {
      enabled: parsersEnabled,
    });

    setParserEnabled(parsersEnabled);

    const jsonParserVariable = sceneGraph.lookupVariable(VAR_JSON_PARSER, this);
    const logfmtParserVariable = sceneGraph.lookupVariable(VAR_LOGFMT_PARSER, this);
    if (jsonParserVariable instanceof CustomConstantVariable) {
      const segment = getJsonParserSegment(parsersEnabled);
      jsonParserVariable.setState({ options: [{ label: segment, value: segment }], text: segment, value: segment });
    }
    if (logfmtParserVariable instanceof CustomConstantVariable) {
      const segment = getLogfmtParserSegment(parsersEnabled);
      logfmtParserVariable.setState({ options: [{ label: segment, value: segment }], text: segment, value: segment });
    }

    this.setState({ parsersEnabled });

    const indexScene = sceneGraph.getAncestor(this, IndexScene);

    // Parsed-field, JSON-path and line-format filters require a parser, so remove them when disabling
    // to avoid sending invalid queries.
    if (!parsersEnabled) {
      indexScene.clearParserDependentFilters();
    }

    // Re-run every query under the index scene so the new parser setting is applied immediately. Queries
    // built from a fixed expression (e.g. breakdown panels) are re-evaluated against the gate when rebuilt.
    sceneGraph.findDescendents(indexScene, SceneQueryRunner).forEach((queryRunner) => {
      queryRunner.runQueries();
    });
  };

  static Component = ({ model }: SceneComponentProps<VariableLayoutScene>) => {
    const indexScene = sceneGraph.getAncestor(model, IndexScene);
    const { controls, patterns, embedded, kgAnnotationToggle } = indexScene.useState();
    const layoutScene = sceneGraph.getAncestor(model, LayoutScene);
    const { levelsRenderer, lineFilterRenderer } = layoutScene.useState();
    const height = useChromeHeaderHeight();
    const { collapsed, parsersEnabled } = model.useState();
    const styles = useStyles2((theme) => getStyles(theme, height ?? 40, collapsed));
    const slug = getDrilldownSlug();

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
                {embedded && <ResetFiltersButton indexScene={indexScene} />}
              </div>
              <div className={styles.controlsWrapper}>
                {!indexScene.state.embedded && <GiveFeedbackButton />}
                <div className={styles.timeRangeDatasource}>
                  {model.state.embeddedLink && <model.state.embeddedLink.Component model={model.state.embeddedLink} />}

                  {controls.map((control) => {
                    return control.state.key === CONTROLS_VARS_DATASOURCE ? (
                      <control.Component key={control.state.key} model={control} />
                    ) : null;
                  })}

                  {slug !== PageSlugs.explore && (
                    <>
                      <ToolbarButton
                        className={collapsed ? styles.iconCollapsed : styles.iconExpanded}
                        variant={collapsed ? 'active' : 'canvas'}
                        icon="arrow-from-right"
                        onClick={model.toggleCollapsedState}
                        tooltip={
                          collapsed
                            ? t('components.index-scene.variable-layout-scene.expand', 'Expand filters')
                            : t('components.index-scene.variable-layout-scene.collapse', 'Collapse filters')
                        }
                      />
                      <ToolbarButton
                        variant={parsersEnabled ? 'active' : 'canvas'}
                        onClick={model.toggleParser}
                        data-testid={testIds.index.parserToggle}
                        tooltip={
                          parsersEnabled
                            ? t(
                                'components.index-scene.variable-layout.parser-toggle.tooltip-enabled',
                                'Parsers are on. Click to disable extracting fields from the logs using JSON and logfmt parsers.'
                              )
                            : t(
                                'components.index-scene.variable-layout.parser-toggle.tooltip-disabled',
                                'Parsers are off. Click to enable JSON and logfmt parsers to extract fields from the log lines.'
                              )
                        }
                      >
                        {t('components.index-scene.variable-layout.parser-toggle.label', 'P')}
                      </ToolbarButton>
                    </>
                  )}

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

          {/* 2nd row — Log levels, Fields (+ metadata), Line filters (same row); KG toggle when shown */}
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
            {lineFilterRenderer && <lineFilterRenderer.Component model={lineFilterRenderer} />}
            {kgAnnotationToggle && slug !== PageSlugs.explore && (
              <kgAnnotationToggle.Component model={kgAnnotationToggle} />
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
        </>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, height: number, headerCollapsed = false) {
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
      display: headerCollapsed ? 'none' : 'flex',
      flexWrap: 'wrap',
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
    }),
    firstRowWrapper: css({
      '& > div > div': {
        [theme.breakpoints.down('lg')]: {
          flexDirection: 'column',
        },
        gap: '16px',

        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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
    iconCollapsed: css({
      svg: {
        transform: 'rotate(90deg)',
      },
    }),
    iconExpanded: css({
      svg: {
        transform: 'rotate(-90deg)',
      },
    }),
  };
}
