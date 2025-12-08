import React, { useEffect } from 'react';

import { css } from '@emotion/css';
import { firstValueFrom } from 'rxjs';

import { createAssistantContextItem, isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { BusEventBase, DataFrame, GrafanaTheme2, PanelMenuItem, PluginExtensionLink, TimeRange } from '@grafana/data';
// Certain imports are not available in the dependant package, but can be if the plugin is running in a different Grafana version.
// We need both imports to support Grafana v11 and v12.
import {
  getDataSourceSrv,
  getObservablePluginLinks,
  // @ts-expect-error
  getPluginLinkExtensions,
  usePluginComponent,
} from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneCSSGridItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';
import { Panel } from '@grafana/schema';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { ExtensionPoints } from '../../services/extensions/links';
import { logger } from '../../services/logger';
import { getQueryExpression } from '../../services/queryRunner';
import { findObjectOfType, getDataSource } from '../../services/scenes';
import { setPanelOption } from '../../services/store';
import { DetectedFieldType } from '../../services/variables';
import { IndexScene } from '../IndexScene/IndexScene';
import { AddToInvestigationButton } from '../ServiceScene/Breakdowns/AddToInvestigationButton';
import { FieldsAggregatedBreakdownScene } from '../ServiceScene/Breakdowns/FieldsAggregatedBreakdownScene';
import { FieldsVizPanelWrapper } from '../ServiceScene/Breakdowns/FieldsVizPanelWrapper';
import { setValueSummaryHeight } from '../ServiceScene/Breakdowns/Panels/ValueSummary';
import { onExploreLinkClick } from '../ServiceScene/OnExploreLinkClick';
import { isLogsQuery } from 'services/logql';

const ADD_TO_INVESTIGATION_MENU_TEXT = 'Add to investigation';
const ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT = 'investigations_divider'; // Text won't be visible
const ADD_TO_INVESTIGATION_MENU_GROUP_TEXT = 'Investigations';

export enum TimeSeriesPanelType {
  'timeseries' = 'timeseries',
  'histogram' = 'histogram',
}

export enum TimeSeriesQueryType {
  'avg' = 'avg',
  'count' = 'count',
}

export enum CollapsablePanelText {
  collapsed = 'Collapse',
  expanded = 'Expand',
}

interface InvestigationOptions {
  fieldName?: string;
  frame?: DataFrame;
  getLabelName?: () => string;
  labelName?: string;
  type?: 'logs' | 'timeseries';
}

interface PanelMenuState extends SceneObjectState {
  addInvestigationsLink?: boolean;
  body?: VizPanelMenu;
  fieldType?: DetectedFieldType;
  investigationOptions?: InvestigationOptions;
  investigationsButton?: AddToInvestigationButton;
  panelType?: TimeSeriesPanelType;
}

/**
 * @todo the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 */
export class PanelMenu extends SceneObjectBase<PanelMenuState> implements VizPanelMenu, SceneObject {
  constructor(state: Partial<PanelMenuState>) {
    super({ ...state, addInvestigationsLink: state.addInvestigationsLink ?? true });
    this.addActivationHandler(() => {
      // Navigation options (all panels)
      const items: PanelMenuItem[] = [
        {
          text: 'Navigation',
          type: 'group',
        },
        {
          href: getExploreLink(this),
          iconClassName: 'compass',
          onClick: () => onExploreLinkClickTracking(),
          shortcut: 'p x',
          text: 'Explore',
        },
      ];

      let viz;
      try {
        viz = sceneGraph.getAncestor(this, VizPanel);
      } catch (e) {
        // If we can't find the viz panel, we can't add the Explore item. Currently the case for logs table.
        this.setState({
          body: new VizPanelMenu({
            items,
          }),
        });
        return;
      }

      this.setState({
        investigationsButton: new AddToInvestigationButton({
          fieldName: this.state.investigationOptions?.fieldName,
          frame: this.state.investigationOptions?.frame,
          labelName: this.state.investigationOptions?.getLabelName
            ? this.state.investigationOptions?.getLabelName()
            : this.state.investigationOptions?.labelName,
          type: this.state.investigationOptions?.type,
        }),
      });

      if (this.state.addInvestigationsLink) {
        // @todo rewrite the AddToExplorationButton
        // Manually activate scene
        this.state.investigationsButton?.activate();
      }

      const vizPanelWrapper = findObjectOfType(this, (o) => o instanceof FieldsVizPanelWrapper, FieldsVizPanelWrapper);
      const histogramSupported = this.state.panelType && vizPanelWrapper?.state.queryType === TimeSeriesQueryType.avg;
      const queryTypeToggleSupported = vizPanelWrapper?.state.supportsHistogram && this.state.fieldType === 'int';

      // Visualization options
      if (histogramSupported || queryTypeToggleSupported || viz?.state.collapsible) {
        addVisualizationHeader(items);
      }

      if (viz?.state.collapsible) {
        addCollapsableItem(items, this);
      }

      if (histogramSupported) {
        addHistogramItem(items, this);
      }

      if (queryTypeToggleSupported) {
        addToggleQueryType(items, this);
      }

      this.setState({
        body: new VizPanelMenu({
          items,
        }),
      });

      this._subs.add(
        isAssistantAvailable().subscribe(async (isAvailable) => {
          if (isAvailable) {
            const datasource = await getDataSourceSrv().get(getDataSource(this));
            this.addItem({
              text: 'ai_divider',
              type: 'divider',
            });
            this.addItem({
              text: 'AI',
              type: 'group',
            });
            this.addItem({
              iconClassName: 'ai-sparkle',
              text: 'Explain in Assistant',
              onClick: () => {
                openAssistant({
                  origin: 'logs-drilldown-panel',
                  prompt:
                    'Help me understand this query and provide a summary of the data. Be concise and to the point.',
                  context: [
                    createAssistantContextItem('datasource', {
                      datasourceUid: datasource.uid,
                    }),
                    createAssistantContextItem('structured', {
                      title: 'Logs Drilldown Query',
                      data: {
                        query: getQueryExpression(this),
                      },
                    }),
                  ],
                });
              },
            });
          }
        })
      );

      this._subs.add(
        this.state.investigationsButton?.subscribeToState(async () => {
          await subscribeToAddToInvestigation(this);
        })
      );
    });
  }

  addItem(item: PanelMenuItem): void {
    if (this.state.body) {
      this.state.body.addItem(item);
    }
  }

  setItems(items: PanelMenuItem[]): void {
    if (this.state.body) {
      this.state.body.setItems(items);
    }
  }

  public static Component = ({ model }: SceneComponentProps<PanelMenu>) => {
    const { body } = model.useState();
    const { component: AddToDashboardComponent, isLoading: isLoadingAddToDashboard } = usePluginComponent(
      'grafana/add-to-dashboard-form/v1'
    );

    // Update availability flag when component loads
    useEffect(() => {
      const isAvailable = !isLoadingAddToDashboard && Boolean(AddToDashboardComponent);

      // Log warning if component failed to load
      if (!isLoadingAddToDashboard && !AddToDashboardComponent) {
        logger.warn(`Failed to load add to dashboard component: grafana/add-to-dashboard-form/v1`);
      }

      if (isAvailable) {
        addItemToGroup(
          model,
          {
            text: 'Add to Dashboard',
            onClick: () => {
              model.publishEvent(new AddToDashboardEvent(getAddToDashboardPayload(model)), true);
            },
            iconClassName: 'apps',
          },
          'Navigation'
        );
      }
    }, [isLoadingAddToDashboard, AddToDashboardComponent, model]);

    if (body) {
      return <body.Component model={body} />;
    }

    return <></>;
  };
}

function addVisualizationHeader(items: PanelMenuItem[]) {
  items.push({
    text: 'visualization_divider',
    type: 'divider',
  });
  items.push({
    text: 'Visualization',
    type: 'group',
  });
}

function addCollapsableItem(items: PanelMenuItem[], menu: PanelMenu) {
  const viz = sceneGraph.getAncestor(menu, VizPanel);
  items.push({
    iconClassName: viz.state.collapsed ? 'table-collapse-all' : 'table-expand-all',
    onClick: () => {
      const newCollapsableState = viz.state.collapsed ? CollapsablePanelText.expanded : CollapsablePanelText.collapsed;

      // Update the viz
      const vizPanelFlexLayout = sceneGraph.getAncestor(menu, SceneFlexLayout);
      setValueSummaryHeight(vizPanelFlexLayout, newCollapsableState);

      // Set state and update local storage
      viz.setState({
        collapsed: !viz.state.collapsed,
      });
      setPanelOption('collapsed', newCollapsableState);
    },
    text: viz.state.collapsed ? CollapsablePanelText.expanded : CollapsablePanelText.collapsed,
  });
}

/**
 * "int" fields are ambiguous if they should be count_over_time or avg queries, so we allow the user to toggle individual panels between avg and count queries
 * @todo persist selection
 * @param items
 * @param sceneRef
 */
function addToggleQueryType(items: PanelMenuItem[], sceneRef: PanelMenu) {
  const vizPanelWrapper = sceneGraph.getAncestor(sceneRef, FieldsVizPanelWrapper);
  const isAvgQuery = vizPanelWrapper.state.queryType === TimeSeriesQueryType.avg;

  items.push({
    iconClassName: 'heart-rate',
    onClick: () => {
      const newQueryType =
        vizPanelWrapper.state.queryType === TimeSeriesQueryType.avg
          ? TimeSeriesQueryType.count
          : TimeSeriesQueryType.avg;

      vizPanelWrapper.setState({
        queryType: newQueryType,
      });

      const fieldsAggregatedBreakdownScene = findObjectOfType(
        sceneRef,
        (o) => o instanceof FieldsAggregatedBreakdownScene,
        FieldsAggregatedBreakdownScene
      );
      if (fieldsAggregatedBreakdownScene) {
        fieldsAggregatedBreakdownScene.rebuildChangedPanels('queryType');
      }
      onSwitchQueryTypeTracking(newQueryType);
    },
    text: isAvgQuery ? 'Plot series' : 'Plot average',
  });
}

function addHistogramItem(items: PanelMenuItem[], sceneRef: PanelMenu) {
  items.push({
    iconClassName: sceneRef.state.panelType !== TimeSeriesPanelType.histogram ? 'graph-bar' : 'chart-line',
    onClick: () => {
      const gridItem = sceneGraph.getAncestor(sceneRef, SceneCSSGridItem);
      const vizWrap = sceneGraph.getAncestor(sceneRef, FieldsVizPanelWrapper);
      const viz = vizWrap.state.viz.clone();
      const newPanelType =
        sceneRef.state.panelType !== TimeSeriesPanelType.timeseries
          ? TimeSeriesPanelType.timeseries
          : TimeSeriesPanelType.histogram;
      setPanelOption('panelType', newPanelType);

      gridItem.setState({
        body: new FieldsVizPanelWrapper({
          viz: viz,
          queryType: vizWrap.state.queryType,
          supportsHistogram: true,
        }),
      });

      const fieldsAggregatedBreakdownScene = findObjectOfType(
        gridItem,
        (o) => o instanceof FieldsAggregatedBreakdownScene,
        FieldsAggregatedBreakdownScene
      );
      if (fieldsAggregatedBreakdownScene) {
        fieldsAggregatedBreakdownScene.rebuildChangedPanels('panelType');
      }

      onSwitchVizTypeTracking(newPanelType);
    },

    text: sceneRef.state.panelType !== TimeSeriesPanelType.histogram ? 'Histogram' : 'Time series',
  });
}

export const getExploreLink = (sceneRef: SceneObject) => {
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  const expr = getQueryExpression(sceneRef);

  return onExploreLinkClick(indexScene, expr);
};

export const getAddToDashboardPayload = (model: PanelMenu) => {
  const indexScene = sceneGraph.getAncestor(model, IndexScene);
  let sourcePanel: VizPanel | undefined = undefined;
  try {
    sourcePanel = sceneGraph.getAncestor(model, VizPanel);
  } catch (e) {}

  const expr = getQueryExpression(model);
  const datasource = getDataSource(indexScene);
  const timeRange = sceneGraph.getTimeRange(indexScene).state.value;

  const type = model.state.investigationOptions?.type ?? (isLogsQuery(expr) ? 'logs' : 'timeseries');
  const labelName = model.state.investigationOptions?.getLabelName
    ? model.state.investigationOptions?.getLabelName()
    : model.state.investigationOptions?.labelName;
  const title = labelName ?? (isLogsQuery(expr) ? 'Logs' : 'Metric query');

  const request = sourcePanel?.state.$data?.state.data?.request;
  const target = request?.targets?.[0];

  const legendFormat: string =
    target && 'legendFormat' in target && typeof target.legendFormat === 'string' ? target.legendFormat : '';

  const panel: Panel = {
    ...request,
    type,
    title,
    targets: [{ refId: 'A', expr, legendFormat }],
    datasource: {
      type: 'loki',
      uid: datasource,
    },
    // @ts-expect-error
    fieldConfig: sourcePanel?.state.fieldConfig,
    options: sourcePanel?.state.options,
  };
  return { panel, timeRange };
};

const onExploreLinkClickTracking = () => {
  reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.open_in_explore_menu_clicked);
};

const onSwitchVizTypeTracking = (newVizType: TimeSeriesPanelType) => {
  reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.change_viz_type, {
    newVizType,
  });
};

const onSwitchQueryTypeTracking = (newQueryType: TimeSeriesQueryType) => {
  reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.change_query_type, {
    newQueryType: newQueryType,
  });
};

const getInvestigationLink = async (addToInvestigation: AddToInvestigationButton) => {
  const extensionPointId = ExtensionPoints.MetricInvestigation;
  const context = addToInvestigation.state.context;

  // `getPluginLinkExtensions` is removed in Grafana v12
  if (getPluginLinkExtensions !== undefined) {
    const links = getPluginLinkExtensions({
      context,
      extensionPointId,
    });

    return links.extensions[0];
  }

  // `getObservablePluginLinks` is introduced in Grafana v12
  if (getObservablePluginLinks !== undefined) {
    const links: PluginExtensionLink[] = await firstValueFrom(
      getObservablePluginLinks({
        context,
        extensionPointId,
      })
    );

    return links[0];
  }

  return undefined;
};

async function subscribeToAddToInvestigation(exploreLogsVizPanelMenu: PanelMenu) {
  const addToInvestigationButton = exploreLogsVizPanelMenu.state.investigationsButton;
  if (addToInvestigationButton) {
    const link = await getInvestigationLink(addToInvestigationButton);

    const existingMenuItems = exploreLogsVizPanelMenu.state.body?.state.items ?? [];

    const existingAddToExplorationLink = existingMenuItems.find((item) => item.text === ADD_TO_INVESTIGATION_MENU_TEXT);

    if (link) {
      if (!existingAddToExplorationLink) {
        exploreLogsVizPanelMenu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
          type: 'divider',
        });
        exploreLogsVizPanelMenu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_GROUP_TEXT,
          type: 'group',
        });
        exploreLogsVizPanelMenu.state.body?.addItem({
          iconClassName: 'plus-square',
          onClick: (e) => link.onClick && link.onClick(e),
          text: ADD_TO_INVESTIGATION_MENU_TEXT,
        });
      } else {
        if (existingAddToExplorationLink) {
          exploreLogsVizPanelMenu.state.body?.setItems(
            existingMenuItems.filter(
              (item) =>
                [
                  ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
                  ADD_TO_INVESTIGATION_MENU_GROUP_TEXT,
                  ADD_TO_INVESTIGATION_MENU_TEXT,
                ].includes(item.text) === false
            )
          );
        }
      }
    }
  }
}

function addItemToGroup(model: PanelMenu, item: PanelMenuItem, group: string) {
  if (!model.state.body || !model.state.body.state.items) {
    return;
  }
  let groupIndex: undefined | number = undefined;
  const index = model.state.body.state.items.findIndex((item, i) => {
    if (item.type === 'group' && item.text === group) {
      groupIndex = i;
      return false;
    }
    if ((groupIndex !== undefined && item.type === 'group') || item.type === 'divider') {
      return true;
    }
    return false;
  });
  // There is no other group or divider after the provided group, the item can be added as the last item.
  if (index < 0) {
    model.addItem(item);
    return;
  }
  // Insert item at the last position of the group
  const items = model.state.body.state.items.slice();
  items.splice(index, 0, item);
  model.setItems(items);
}

export interface AddToDashboardData {
  panel: Panel;
  timeRange: TimeRange;
}

export class AddToDashboardEvent extends BusEventBase {
  constructor(public payload: AddToDashboardData) {
    super();
  }
  public static type = 'add-to-dashboard';
}

export const getPanelWrapperStyles = (theme: GrafanaTheme2) => {
  return {
    panelWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      label: 'panel-wrapper',
      position: 'absolute',
      width: '100%',
      // Downgrade severity of panel error
      'button[aria-label="Panel status"]': {
        background: 'transparent',
        color: theme.colors.error.text,
      },
    }),
  };
};
