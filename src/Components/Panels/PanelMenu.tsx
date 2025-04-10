import { DataFrame, GrafanaTheme2, PanelMenuItem, PluginExtensionLink } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';
import React from 'react';
import { onExploreLinkClick } from '../ServiceScene/GoToExploreButton';
import { IndexScene } from '../IndexScene/IndexScene';
import { findObjectOfType, getQueryRunnerFromChildren } from '../../services/scenes';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { logger } from '../../services/logger';
import { AddToInvestigationButton } from '../ServiceScene/Breakdowns/AddToInvestigationButton';
// Certain imports are not available in the dependant package, but can be if the plugin is running in a different Grafana version.
// We need both imports to support Grafana v11 and v12.
// @ts-expect-error
import { getObservablePluginLinks, getPluginLinkExtensions } from '@grafana/runtime';
import { ExtensionPoints } from '../../services/extensions/links';
import { setLevelColorOverrides } from '../../services/panel';
import { setPanelOption } from '../../services/store';
import { FieldsAggregatedBreakdownScene } from '../ServiceScene/Breakdowns/FieldsAggregatedBreakdownScene';
import { setValueSummaryHeight } from '../ServiceScene/Breakdowns/Panels/ValueSummary';
import { FieldValuesBreakdownScene } from '../ServiceScene/Breakdowns/FieldValuesBreakdownScene';
import { LabelValuesBreakdownScene } from '../ServiceScene/Breakdowns/LabelValuesBreakdownScene';
import { css } from '@emotion/css';
import { firstValueFrom } from 'rxjs';

const ADD_TO_INVESTIGATION_MENU_TEXT = 'Add to investigation';
const ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT = 'investigations_divider'; // Text won't be visible
const ADD_TO_INVESTIGATION_MENU_GROUP_TEXT = 'Investigations';

export enum AvgFieldPanelType {
  'timeseries' = 'timeseries',
  'histogram' = 'histogram',
}

export enum CollapsablePanelText {
  collapsed = 'Collapse',
  expanded = 'Expand',
}

interface InvestigationOptions {
  labelName?: string;
  fieldName?: string;
  frame?: DataFrame;
  type?: 'timeseries' | 'logs';
  getLabelName?: () => string;
}

interface PanelMenuState extends SceneObjectState {
  body?: VizPanelMenu;
  addInvestigationsLink?: boolean;
  investigationsButton?: AddToInvestigationButton;
  panelType?: AvgFieldPanelType;

  investigationOptions?: InvestigationOptions;
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
          text: 'Explore',
          iconClassName: 'compass',
          href: getExploreLink(this),
          onClick: () => onExploreLinkClickTracking(),
          shortcut: 'p x',
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
          labelName: this.state.investigationOptions?.getLabelName
            ? this.state.investigationOptions?.getLabelName()
            : this.state.investigationOptions?.labelName,
          fieldName: this.state.investigationOptions?.fieldName,
          frame: this.state.investigationOptions?.frame,
          type: this.state.investigationOptions?.type,
        }),
      });

      if (this.state.addInvestigationsLink) {
        // @todo rewrite the AddToExplorationButton
        // Manually activate scene
        this.state.investigationsButton?.activate();
      }

      // Visualization options
      if (this.state.panelType || viz?.state.collapsible) {
        addVisualizationHeader(items, this);
      }

      if (viz?.state.collapsible) {
        addCollapsableItem(items, this);
      }

      if (this.state.panelType) {
        addHistogramItem(items, this);
      }

      this.setState({
        body: new VizPanelMenu({
          items,
        }),
      });

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

    if (body) {
      return <body.Component model={body} />;
    }

    return <></>;
  };
}

function addVisualizationHeader(items: PanelMenuItem[], sceneRef: PanelMenu) {
  items.push({
    text: '',
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
    text: viz.state.collapsed ? CollapsablePanelText.expanded : CollapsablePanelText.collapsed,
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
  });
}

function addHistogramItem(items: PanelMenuItem[], sceneRef: PanelMenu) {
  items.push({
    text: sceneRef.state.panelType !== AvgFieldPanelType.histogram ? 'Histogram' : 'Time series',
    iconClassName: sceneRef.state.panelType !== AvgFieldPanelType.histogram ? 'graph-bar' : 'chart-line',

    onClick: () => {
      const gridItem = sceneGraph.getAncestor(sceneRef, SceneCSSGridItem);
      const viz = sceneGraph.getAncestor(sceneRef, VizPanel).clone();
      const $data = sceneGraph.getData(sceneRef).clone();
      const menu = sceneRef.clone();
      const headerActions = Array.isArray(viz.state.headerActions)
        ? viz.state.headerActions.map((o) => o.clone())
        : viz.state.headerActions;
      let body;

      if (sceneRef.state.panelType !== AvgFieldPanelType.histogram) {
        body = PanelBuilders.timeseries().setOverrides(setLevelColorOverrides);
      } else {
        body = PanelBuilders.histogram();
      }

      gridItem.setState({
        body: body.setMenu(menu).setTitle(viz.state.title).setHeaderActions(headerActions).setData($data).build(),
      });

      const newPanelType =
        sceneRef.state.panelType !== AvgFieldPanelType.timeseries
          ? AvgFieldPanelType.timeseries
          : AvgFieldPanelType.histogram;
      setPanelOption('panelType', newPanelType);
      menu.setState({ panelType: newPanelType });

      const fieldsAggregatedBreakdownScene = findObjectOfType(
        gridItem,
        (o) => o instanceof FieldsAggregatedBreakdownScene,
        FieldsAggregatedBreakdownScene
      );
      if (fieldsAggregatedBreakdownScene) {
        fieldsAggregatedBreakdownScene.rebuildAvgFields();
      }

      onSwitchVizTypeTracking(newPanelType);
    },
  });
}

export const getExploreLink = (sceneRef: SceneObject) => {
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  const $data = sceneGraph.getData(sceneRef);
  let queryRunner = $data instanceof SceneQueryRunner ? $data : getQueryRunnerFromChildren($data)[0];

  // If we don't have a query runner, then our panel is within a SceneCSSGridItem, we need to get the query runner from there
  if (!queryRunner) {
    const breakdownScene = sceneGraph.findObject(
      sceneRef,
      (o) => o instanceof FieldValuesBreakdownScene || o instanceof LabelValuesBreakdownScene
    );
    if (breakdownScene) {
      const queryProvider = sceneGraph.getData(breakdownScene);

      if (queryProvider instanceof SceneQueryRunner) {
        queryRunner = queryProvider;
      } else {
        queryRunner = getQueryRunnerFromChildren(queryProvider)[0];
      }
    } else {
      logger.error(new Error('Unable to locate query runner!'), {
        msg: 'PanelMenu - getExploreLink: Unable to locate query runner!',
      });
    }
  }
  const uninterpolatedExpr: string | undefined = queryRunner.state.queries[0].expr;
  const expr = sceneGraph.interpolate(sceneRef, uninterpolatedExpr);

  return onExploreLinkClick(indexScene, expr);
};

const onExploreLinkClickTracking = () => {
  reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.open_in_explore_menu_clicked);
};

const onSwitchVizTypeTracking = (newVizType: AvgFieldPanelType) => {
  reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.change_viz_type, {
    newVizType,
  });
};

const getInvestigationLink = async (addToInvestigation: AddToInvestigationButton) => {
  const extensionPointId = ExtensionPoints.MetricInvestigation;
  const context = addToInvestigation.state.context;

  // `getPluginLinkExtensions` is removed in Grafana v12
  if (getPluginLinkExtensions !== undefined) {
    const links = getPluginLinkExtensions({
      extensionPointId,
      context,
    });

    return links.extensions[0];
  }

  // `getObservablePluginLinks` is introduced in Grafana v12
  if (getObservablePluginLinks !== undefined) {
    const links: PluginExtensionLink[] = await firstValueFrom(
      getObservablePluginLinks({
        extensionPointId,
        context,
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
          text: ADD_TO_INVESTIGATION_MENU_TEXT,
          iconClassName: 'plus-square',
          onClick: (e) => link.onClick && link.onClick(e),
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

export const getPanelWrapperStyles = (theme: GrafanaTheme2) => {
  return {
    panelWrapper: css({
      width: '100%',
      height: '100%',
      label: 'panel-wrapper',
      position: 'absolute',
      display: 'flex',
    }),
  };
};
