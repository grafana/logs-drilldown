import {
  EmbeddedScene,
  SceneAppPage,
  SceneAppPageLike,
  SceneFlexLayout,
  SceneReactObject,
  SceneRouteMatch,
  SceneTimeRange,
} from '@grafana/scenes';
import {
  CHILD_ROUTE_DEFINITIONS,
  ChildDrilldownSlugs,
  DRILLDOWN_URL_KEYS,
  extractValuesFromRoute,
  PageSlugs,
  ParentDrilldownSlugs,
  ROUTE_DEFINITIONS,
  ROUTES,
  SERVICE_URL_KEYS,
  SUB_ROUTES,
  ValueSlugs,
} from '../services/routing';
import { dateTimeParse, PageLayoutType, TimeRange } from '@grafana/data';
import { IndexScene } from './IndexScene/IndexScene';
import { navigateToIndex } from '../services/navigate';
import { logger } from '../services/logger';
import { capitalizeFirstLetter } from '../services/text';
import { PLUGIN_BASE_URL, prefixRoute } from '../services/plugin';
import { EmbeddedLogsExplorationProps } from './EmbeddedLogsExploration/types';
import React from 'React';
import { SuspendedEmbeddedLogsExploration } from '../services/extensions/exposedComponents';

export type RouteProps = { labelName: string; labelValue: string; breakdownLabel?: string };
export type RouteMatch = SceneRouteMatch<RouteProps>;
type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
export type OptionalRouteProps = Optional<RouteProps, 'labelName' | 'labelValue'>;
export type OptionalRouteMatch = SceneRouteMatch<OptionalRouteProps>;

export const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };
function getServicesScene(routeMatch: OptionalRouteMatch) {
  return new EmbeddedScene({
    body: new IndexScene({
      $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
      routeMatch,
    }),
  });
}

function EmbeddedSceneWrapper(props: EmbeddedLogsExplorationProps) {
  // Component is always null, doesn't look like we can embed something from the same app?
  // const { component: Component, isLoading } = usePluginComponents<EmbeddedLogsExplorationProps>({
  //   extensionPointId: 'grafana-lokiexplore-app/embedded-logs-exploration/v1',
  // });
  //
  // console.log('Component', { Component, isLoading });

  return <SuspendedEmbeddedLogsExploration {...props} />;
}

function getEmbedScene() {
  // @todo form field inputs?
  const dsUID = 'PDDA8E780A17E7EF1';
  const initialStart = 'now-15m';
  const initialEnd = 'now';
  const query = '{service_name="nginx"}';
  const onTimeRangeChange = (timeRange: TimeRange) => {
    console.log('onTimeRangeChange', timeRange);
  };

  const from = dateTimeParse(initialStart);
  const to = dateTimeParse(initialEnd);

  const timeRange: TimeRange = {
    from,
    to,
    raw: {
      from: initialStart,
      to: initialEnd,
    },
  };

  const $timeRange = new SceneTimeRange({
    value: timeRange,
    from: initialStart,
    to: initialEnd,
  });

  const props: EmbeddedLogsExplorationProps = {
    embedded: true,
    datasourceUid: dsUID,
    timeRangeState: $timeRange.state,
    onTimeRangeChange,
    query,
  };

  return new EmbeddedScene({
    body: new SceneReactObject({
      reactNode: <EmbeddedSceneWrapper {...props} />,
    }),
  });
}

export function makeEmbedPage() {
  return new SceneAppPage({
    title: 'Grafana Logs Drilldown — Embedded',
    url: prefixRoute(PageSlugs.embed),
    layout: PageLayoutType.Custom,
    routePath: prefixRoute(PageSlugs.embed),
    getScene: (routeMatch) => getEmbedScene(),
    drilldowns: [
      {
        routePath: ROUTE_DEFINITIONS.embed,
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.embed),
      },
    ],
  });
}

// Index page
export function makeIndexPage() {
  return new SceneAppPage({
    // Top level breadcrumb
    title: 'Grafana Logs Drilldown',
    url: prefixRoute(PageSlugs.explore),
    layout: PageLayoutType.Custom,
    preserveUrlKeys: SERVICE_URL_KEYS,
    routePath: prefixRoute(PageSlugs.explore),
    getScene: (routeMatch) => getServicesScene(routeMatch),
    drilldowns: [
      {
        routePath: ROUTE_DEFINITIONS.logs,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.logs),
        defaultRoute: true,
      },
      {
        routePath: ROUTE_DEFINITIONS.labels,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.labels),
      },
      {
        routePath: ROUTE_DEFINITIONS.patterns,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.patterns),
      },
      {
        routePath: ROUTE_DEFINITIONS.fields,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.fields),
      },
      {
        routePath: CHILD_ROUTE_DEFINITIONS.label,
        getPage: (routeMatch, parent) => makeBreakdownValuePage(routeMatch, parent, ValueSlugs.label),
      },
      {
        routePath: CHILD_ROUTE_DEFINITIONS.field,
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownValuePage(routeMatch, parent, ValueSlugs.field),
      },
    ],
  });
}

// Redirect page back to index
export function makeRedirectPage() {
  return new SceneAppPage({
    title: '',
    url: PLUGIN_BASE_URL,
    getScene: makeEmptyScene(),
    hideFromBreadcrumbs: true,
    routePath: '*',
    $behaviors: [
      () => {
        navigateToIndex();
      },
    ],
  });
}

function makeEmptyScene(): (routeMatch: SceneRouteMatch) => EmbeddedScene {
  return () =>
    new EmbeddedScene({
      body: new SceneFlexLayout({
        direction: 'column',
        children: [],
      }),
    });
}

export function makeBreakdownPage(
  routeMatch: RouteMatch,
  parent: SceneAppPageLike,
  slug: ParentDrilldownSlugs
): SceneAppPage {
  const { labelName, labelValue } = extractValuesFromRoute(routeMatch);
  return new SceneAppPage({
    title: capitalizeFirstLetter(slug),
    layout: PageLayoutType.Custom,
    url: ROUTES[slug](labelValue, labelName),
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    getParentPage: () => parent,
    getScene: (routeMatch) => getServicesScene(routeMatch),
  });
}

export function makeBreakdownValuePage(
  routeMatch: RouteMatch,
  parent: SceneAppPageLike,
  slug: ChildDrilldownSlugs
): SceneAppPage {
  const { labelName, labelValue, breakdownLabel } = extractValuesFromRoute(routeMatch);

  if (!breakdownLabel) {
    const e = new Error('Breakdown value missing!');
    logger.error(e, {
      msg: 'makeBreakdownValuePage: Breakdown value missing!',
      labelName,
      labelValue,
      breakdownLabel: breakdownLabel ?? '',
    });
    throw e;
  }

  return new SceneAppPage({
    title: capitalizeFirstLetter(breakdownLabel),
    layout: PageLayoutType.Custom,
    url: SUB_ROUTES[slug](labelValue, labelName, breakdownLabel),
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    getParentPage: () => parent,
    getScene: (routeMatch) => getServicesScene(routeMatch),
  });
}
