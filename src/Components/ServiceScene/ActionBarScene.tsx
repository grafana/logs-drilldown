import React from 'react';

import { css, cx } from '@emotion/css';

import { getValueFormat, GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Stack, Tab, TabsBar, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { PageSlugs, TabNames, ValueSlugs } from '../../services/enums';
import { getDrillDownTabLink } from '../../services/navigate';
import { LINE_LIMIT } from '../../services/query';
import { getDrilldownSlug, getDrilldownValueSlug } from '../../services/routing';
import { IndexScene } from '../IndexScene/IndexScene';
import { ShareButtonScene } from '../IndexScene/ShareButtonScene';
import { BreakdownViewDefinition, breakdownViewsDefinitions } from './BreakdownViews';
import { ServiceScene, ServiceSceneCustomState } from './ServiceScene';
import { narrowPageSlug } from '../../services/narrowing';

export interface ActionBarSceneState extends SceneObjectState {
  embedded?: boolean;
  maxLines?: number;
  shareButtonScene?: ShareButtonScene;
}

export class ActionBarScene extends SceneObjectBase<ActionBarSceneState> {
  constructor(state: Partial<ActionBarSceneState>) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    const dataSource = indexScene.state.ds;
    if (dataSource?.maxLines !== undefined) {
      this.setState({
        maxLines: dataSource.maxLines,
      });
    }

    if (!this.state.shareButtonScene) {
      this.setState({
        shareButtonScene: new ShareButtonScene({}),
      });
    }
  }

  getPageSlug() {
    const route = getDrilldownSlug();
    if (route !== PageSlugs.embed) {
      return route;
    }
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const narrowedSlug = narrowPageSlug(serviceScene.state.drillDownLabel);
    if (narrowedSlug) {
      return narrowedSlug;
    }

    throw new Error(`invalid page slug ${narrowedSlug}!`);
  }

  public static Component = ({ model }: SceneComponentProps<ActionBarScene>) => {
    const styles = useStyles2(getStyles);
    let currentBreakdownViewSlug = model.getPageSlug();
    let allowNavToParent = false;

    if (!Object.values(PageSlugs).includes(currentBreakdownViewSlug)) {
      const drilldownValueSlug = getDrilldownValueSlug();
      allowNavToParent = true;
      if (drilldownValueSlug === ValueSlugs.field) {
        currentBreakdownViewSlug = PageSlugs.fields;
      }
      if (drilldownValueSlug === ValueSlugs.label) {
        currentBreakdownViewSlug = PageSlugs.labels;
      }
    }

    const serviceScene = sceneGraph.getAncestor(model, ServiceScene);
    const { $data, loading, logsCount, totalLogsCount, ...state } = serviceScene.useState();
    const { maxLines } = model.useState();

    const loadingStates = state.loadingStates;

    return (
      <Box paddingY={0}>
        <div className={styles.actions}>
          <Stack gap={1}>
            {model.state.shareButtonScene && (
              <model.state.shareButtonScene.Component model={model.state.shareButtonScene} />
            )}
          </Stack>
        </div>

        <TabsBar>
          {breakdownViewsDefinitions.map((tab, index) => {
            return (
              <Tab
                data-testid={tab.testId}
                key={index}
                label={tab.displayName}
                active={currentBreakdownViewSlug === tab.value}
                counter={loadingStates[tab.displayName] ? undefined : getCounter(tab, state)}
                suffix={
                  tab.displayName === TabNames.logs
                    ? ({ className }) => LogsCount(className, totalLogsCount, logsCount, maxLines ?? LINE_LIMIT)
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

function LogsCount(
  className: string | undefined,
  totalCount: number | undefined,
  logsCount: number | undefined,
  maxLines: number
) {
  const styles = useStyles2(getLogsCountStyles);
  const valueFormatter = getValueFormat('short');

  // The instant query (totalCount) doesn't return good results for small result sets, if we're below the max number of lines, use the logs query result instead.
  if (totalCount === undefined && logsCount !== undefined && logsCount < maxLines) {
    const formattedCount = valueFormatter(logsCount, 0);
    return (
      <span className={cx(className, styles.logsCountStyles)}>
        {formattedCount.text}
        {formattedCount.suffix?.trim()}
      </span>
    );
  } else if (totalCount !== undefined) {
    const formattedTotalCount = valueFormatter(totalCount, 0);
    return (
      <span className={cx(className, styles.logsCountStyles)}>
        {formattedTotalCount.text}
        {formattedTotalCount.suffix?.trim()}
      </span>
    );
  }

  return <span className={cx(className, styles.emptyCountStyles)}></span>;
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
