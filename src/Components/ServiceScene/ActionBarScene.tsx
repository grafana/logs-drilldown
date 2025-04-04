import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Dropdown, Menu, Stack, Tab, TabsBar, ToolbarButton, useStyles2 } from '@grafana/ui';
import { getDrilldownSlug, getDrilldownValueSlug, PageSlugs, ValueSlugs } from '../../services/routing';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { getDrillDownTabLink } from '../../services/navigate';
import React, { useEffect, useState } from 'react';
import { ServiceScene, ServiceSceneCustomState } from './ServiceScene';
import { getValueFormat, GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { BreakdownViewDefinition, breakdownViewsDefinitions, TabNames } from './BreakdownViews';
import { config, usePluginLinks } from '@grafana/runtime';
import { getLabelsVariable } from '../../services/variableGetters';
import { IndexScene } from '../IndexScene/IndexScene';
import { LINE_LIMIT } from '../../services/query';
import { ShareButtonScene } from '../IndexScene/ShareButtonScene';

export interface ActionBarSceneState extends SceneObjectState {
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
  public static Component = ({ model }: SceneComponentProps<ActionBarScene>) => {
    const styles = useStyles2(getStyles);
    let currentBreakdownViewSlug = getDrilldownSlug();
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
    const { loading, $data, logsCount, totalLogsCount, ...state } = serviceScene.useState();
    const { maxLines } = model.useState();

    const loadingStates = state.loadingStates;

    return (
      <Box paddingY={0}>
        <div className={styles.actions}>
          <Stack gap={1}>
            {config.featureToggles.appSidecar && <ToolbarExtensionsRenderer serviceScene={serviceScene} />}
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
      display: 'flex',
      justifyContent: 'flex-end',

      [theme.breakpoints.up(theme.breakpoints.values.md)]: {
        position: 'absolute',
        right: 0,
        zIndex: 2,
      },
    }),
  };
}

/**
 * Shows extensions in the toolbar.
 * Shows a single button if there is only one extension or a dropdown if there are multiple.
 * @param props
 * @constructor
 */
function ToolbarExtensionsRenderer(props: { serviceScene: SceneObject }) {
  const [filters, setFilters] = useState<Array<{ key: string; value: string }>>(
    getLabelsVariable(props.serviceScene).state.filters
  );
  useEffect(() => {
    const sub = getLabelsVariable(props.serviceScene).subscribeToState((newState) => {
      setFilters(newState.filters);
    });
    return () => {
      sub.unsubscribe();
    };
  }, [props.serviceScene]);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const extensions = usePluginLinks({
    extensionPointId: 'grafana-lokiexplore-app/toolbar-open-related/v1',
    limitPerPlugin: 3,
    context: { filters },
  });

  if (extensions.isLoading || extensions.links.length === 0) {
    return null;
  }

  if (extensions.links.length === 1) {
    const e = extensions.links[0];

    return (
      <div>
        <ToolbarButton variant={'canvas'} key={e.id} onClick={(event) => e.onClick?.(event)} icon={e.icon}>
          Related {e.title}
        </ToolbarButton>
      </div>
    );
  }

  const menu = (
    <Menu>
      {extensions.links.map((link) => {
        return (
          <Menu.Item
            ariaLabel={link.title}
            icon={link?.icon || 'plug'}
            key={link.id}
            label={link.title}
            onClick={(event) => {
              link.onClick?.(event);
            }}
          />
        );
      })}
    </Menu>
  );

  return (
    <Dropdown onVisibleChange={setIsOpen} placement="bottom-start" overlay={menu}>
      <ToolbarButton aria-label="Open related" variant="canvas" isOpen={isOpen}>
        Open related
      </ToolbarButton>
    </Dropdown>
  );
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
      minWidth: '1em',
      marginLeft: theme.spacing(1),
      padding: theme.spacing(0.25, 1),
    }),
    logsCountStyles: css({
      fontSize: theme.typography.bodySmall.fontSize,
      label: 'counter',
      marginLeft: theme.spacing(1),
      borderRadius: theme.spacing(3),
      backgroundColor: theme.colors.action.hover,
      padding: theme.spacing(0.25, 1),
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
}
