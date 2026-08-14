import React from 'react';

import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Stack, Tab, TabsBar, useStyles2 } from '@grafana/ui';

import { BreakdownViewDefinition, breakdownViewsDefinitions } from './BreakdownViews';
import { ServiceScene, ServiceSceneCustomState } from './ServiceScene';
import { ShareButtonScene } from 'Components/IndexScene/ShareButtonScene';
import { LoadSearchScene } from 'Components/SavedSearches/LoadSearchScene';
import { SaveSearchButton } from 'Components/SavedSearches/SaveSearchButton';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { PageSlugs, TabNames, ValueSlugs } from 'services/enums';
import { formatLogsCount, getDisplayedLogsCount } from 'services/logsCount';
import { narrowPageSlug } from 'services/narrowing';
import { getDrillDownTabLink } from 'services/navigate';
import { getDrilldownSlug, getDrilldownValueSlug } from 'services/routing';
import { getMaxLines } from 'services/store';

export interface ActionBarSceneState extends SceneObjectState {
  loadSearchScene?: LoadSearchScene;
  shareButtonScene?: ShareButtonScene;
}

export class ActionBarScene extends SceneObjectBase<ActionBarSceneState> {
  constructor(state: Partial<ActionBarSceneState>) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    if (!this.state.shareButtonScene) {
      this.setState({
        shareButtonScene: new ShareButtonScene({}),
      });
    }

    if (!this.state.loadSearchScene) {
      this.setState({
        loadSearchScene: new LoadSearchScene(),
      });
    }
  }

  getPageSlug() {
    const route = getDrilldownSlug();
    if (route !== PageSlugs.embed) {
      return route;
    }
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const narrowedSlug = narrowPageSlug(serviceScene.state.pageSlug);
    if (narrowedSlug) {
      return narrowedSlug;
    }

    return undefined;
  }

  public static Component = ({ model }: SceneComponentProps<ActionBarScene>) => {
    const styles = useStyles2(getStyles);
    let currentBreakdownViewSlug: PageSlugs | ValueSlugs | undefined;
    let allowNavToParent = false;
    const serviceScene = sceneGraph.getAncestor(model, ServiceScene);

    if (serviceScene.state.embedded && serviceScene.state.pageSlug) {
      currentBreakdownViewSlug = getActiveTabSlug(serviceScene.state.pageSlug);
    } else {
      currentBreakdownViewSlug = model.getPageSlug();

      if (!currentBreakdownViewSlug || !Object.values(PageSlugs).includes(currentBreakdownViewSlug)) {
        const drilldownValueSlug = getDrilldownValueSlug();
        allowNavToParent = true;
        if (drilldownValueSlug) {
          currentBreakdownViewSlug = getActiveTabSlug(drilldownValueSlug);
        }
      }
    }

    const { $data, loading, logsCount, totalLogsCount, ...state } = serviceScene.useState();
    // Read the line limit fresh on every render; a snapshot goes stale when the user changes it
    const displayedLogsCount = getDisplayedLogsCount(totalLogsCount, logsCount, getMaxLines(model));

    const loadingStates = state.loadingStates;

    return (
      <Box paddingY={0}>
        <div className={styles.actions}>
          <Stack gap={1}>
            {model.state.shareButtonScene && (
              <model.state.shareButtonScene.Component model={model.state.shareButtonScene} />
            )}
            <SaveSearchButton sceneRef={model} />
            {model.state.loadSearchScene && (
              <model.state.loadSearchScene.Component model={model.state.loadSearchScene} />
            )}
          </Stack>
        </div>

        <TabsBar>
          {breakdownViewsDefinitions
            .filter(
              (breakdownView) => !(breakdownView.value === PageSlugs.patterns && !serviceScene.state.$patternsData)
            )
            .map((tab, index) => {
              return (
                <Tab
                  data-testid={tab.testId}
                  key={index}
                  label={tab.displayName}
                  active={currentBreakdownViewSlug === tab.value}
                  counter={loadingStates[tab.displayName] ? undefined : getCounter(tab, state)}
                  suffix={
                    tab.displayName === TabNames.logs
                      ? ({ className }) => LogsCount(className, displayedLogsCount)
                      : undefined
                  }
                  icon={loadingStates[tab.displayName] ? 'spinner' : undefined}
                  href={getDrillDownTabLink(tab.value, serviceScene)}
                  onChangeTab={() => {
                    if ((tab.value && tab.value !== currentBreakdownViewSlug) || allowNavToParent) {
                      reportAppInteraction(
                        USER_EVENTS_PAGES.service_details,
                        USER_EVENTS_ACTIONS.service_details.action_view_changed,
                        {
                          newActionView: tab.value,
                          previousActionView: currentBreakdownViewSlug,
                        }
                      );
                    }
                  }}
                />
              );
            })}
        </TabsBar>
      </Box>
    );
  };
}

function getActiveTabSlug(drilldownValueSlug: PageSlugs | ValueSlugs) {
  if (drilldownValueSlug === ValueSlugs.field) {
    return PageSlugs.fields;
  }
  if (drilldownValueSlug === ValueSlugs.label) {
    return PageSlugs.labels;
  }
  return drilldownValueSlug;
}
const getCounter = (tab: BreakdownViewDefinition, state: ServiceSceneCustomState) => {
  switch (tab.value) {
    case 'fields':
      return state.fieldsCount;
    case 'patterns':
      return state.patternsCount;
    case 'labels':
      return state.labelsCount;
    default:
      return undefined;
  }
};

function getStyles(theme: GrafanaTheme2) {
  return {
    actions: css({
      [theme.breakpoints.up(theme.breakpoints.values.md)]: {
        position: 'absolute',
        right: 0,
        zIndex: 2,
      },
      display: 'flex',

      justifyContent: 'flex-end',
    }),
  };
}

function LogsCount(className: string | undefined, count: number | undefined) {
  const styles = useStyles2(getLogsCountStyles);

  if (count === undefined) {
    return <span className={cx(className, styles.emptyCountStyles)}></span>;
  }

  return <span className={cx(className, styles.logsCountStyles)}>{formatLogsCount(count)}</span>;
}

function getLogsCountStyles(theme: GrafanaTheme2) {
  return {
    emptyCountStyles: css({
      display: 'inline-block',
      fontSize: theme.typography.bodySmall.fontSize,
      marginLeft: theme.spacing(1),
      minWidth: '1em',
      padding: theme.spacing(0.25, 1),
    }),
    logsCountStyles: css({
      backgroundColor: theme.colors.action.hover,
      borderRadius: theme.spacing(3),
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      label: 'counter',
      marginLeft: theme.spacing(1),
      padding: theme.spacing(0.25, 1),
    }),
  };
}
