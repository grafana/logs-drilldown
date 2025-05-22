import React, { useMemo } from 'react';

import { dateTimeParse, PageLayoutType, TimeRange, urlUtil } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import {
  EmbeddedScene,
  SceneAppPage,
  SceneAppPageLike,
  SceneFlexLayout,
  SceneReactObject,
  SceneRouteMatch,
  SceneTimeRange,
} from '@grafana/scenes';
import { LoadingPlaceholder } from '@grafana/ui';

import { PageSlugs, ValueSlugs } from '../services/enums';
import { logger } from '../services/logger';
import { navigateToIndex } from '../services/navigate';
import { PLUGIN_BASE_URL, prefixRoute } from '../services/plugin';
import {
  CHILD_ROUTE_DEFINITIONS,
  ChildDrilldownSlugs,
  DRILLDOWN_URL_KEYS,
  extractValuesFromRoute,
  ParentDrilldownSlugs,
  ROUTE_DEFINITIONS,
  ROUTES,
  SERVICE_URL_KEYS,
  SUB_ROUTES,
} from '../services/routing';
import { capitalizeFirstLetter } from '../services/text';
import { EmbeddedLogsExplorationProps } from './EmbeddedLogsExploration/types';
import { IndexScene } from './IndexScene/IndexScene';

export type RouteProps = { breakdownLabel?: string; labelName: string; labelValue: string };
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
  const { component: LogsDrilldownComponent, isLoading } = usePluginComponent<EmbeddedLogsExplorationProps>(
    'grafana-lokiexplore-app/embedded-logs-exploration/v1'
  );

  // We don't want to re-render the entire app every time the props change, only once when the plugin component is done loading
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const Component = useMemo(() => LogsDrilldownComponent, [isLoading]);
  return isLoading || !Component ? <LoadingPlaceholder text={'Loading...'} /> : <Component {...props} />;
}

function getEmbedScene() {
  const initialStart = 'now-15m';
  const initialEnd = 'now';
  const query = '{service_name="tempo-distributor"}';

  const from = dateTimeParse(initialStart);
  const to = dateTimeParse(initialEnd);

  const timeRange: TimeRange = {
    from,
    raw: {
      from: initialStart,
      to: initialEnd,
    },
    to,
  };

  const $timeRange = new SceneTimeRange({
    from: initialStart,
    to: initialEnd,
    value: timeRange,
  });

  const props: EmbeddedLogsExplorationProps = {
    embedded: true,
    query,
    timeRangeState: $timeRange.state,
  };

  return new EmbeddedScene({
    body: new SceneReactObject({
      reactNode: <EmbeddedSceneWrapper {...props} />,
    }),
  });
}

export function makeEmbedPage() {
  return new SceneAppPage({
    drilldowns: [
      {
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.embed),
        routePath: ROUTE_DEFINITIONS.embed,
      },
    ],
    getScene: (routeMatch) => getEmbedScene(),
    layout: PageLayoutType.Custom,
    routePath: `${PageSlugs.embed}`,
    title: 'Grafana Logs Drilldown — Embedded',
    url: prefixRoute(PageSlugs.embed),
  });
}

// Index page
export function makeIndexPage() {
  return new SceneAppPage({
    drilldowns: [
      {
        defaultRoute: true,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.logs),
        routePath: ROUTE_DEFINITIONS.logs,
      },
      {
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.labels),
        routePath: ROUTE_DEFINITIONS.labels,
      },
      {
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.patterns),
        routePath: ROUTE_DEFINITIONS.patterns,
      },
      {
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.fields),
        routePath: ROUTE_DEFINITIONS.fields,
      },
      {
        getPage: (routeMatch, parent) => makeBreakdownValuePage(routeMatch, parent, ValueSlugs.label),
        routePath: CHILD_ROUTE_DEFINITIONS.label,
      },
      {
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownValuePage(routeMatch, parent, ValueSlugs.field),
        routePath: CHILD_ROUTE_DEFINITIONS.field,
      },
    ],
    getScene: (routeMatch) => getServicesScene(routeMatch),
    layout: PageLayoutType.Custom,
    preserveUrlKeys: SERVICE_URL_KEYS,
    routePath: `${PageSlugs.explore}/*`,
    // Top level breadcrumb
    title: 'Grafana Logs Drilldown',
    url: prefixRoute(PageSlugs.explore),
  });
}

// Redirect page back to index
export function makeRedirectPage() {
  return new SceneAppPage({
    $behaviors: [
      () => {
        navigateToIndex();
      },
    ],
    getScene: makeEmptyScene(),
    hideFromBreadcrumbs: true,
    routePath: '*',
    title: '',
    url: urlUtil.renderUrl(PLUGIN_BASE_URL, undefined),
  });
}

function makeEmptyScene(): (routeMatch: SceneRouteMatch) => EmbeddedScene {
  return () =>
    new EmbeddedScene({
      body: new SceneFlexLayout({
        children: [],
        direction: 'column',
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
    getParentPage: () => parent,
    getScene: (routeMatch) => getServicesScene(routeMatch),
    layout: PageLayoutType.Custom,
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    routePath: ROUTE_DEFINITIONS[slug],
    title: capitalizeFirstLetter(slug),
    url: ROUTES[slug](labelValue, labelName),
  });
}

export function makeBreakdownValuePage(
  routeMatch: RouteMatch,
  parent: SceneAppPageLike,
  slug: ChildDrilldownSlugs
): SceneAppPage {
  const { breakdownLabel, labelName, labelValue } = extractValuesFromRoute(routeMatch);

  if (!breakdownLabel) {
    const e = new Error('Breakdown value missing!');
    logger.error(e, {
      breakdownLabel: breakdownLabel ?? '',
      labelName,
      labelValue,
      msg: 'makeBreakdownValuePage: Breakdown value missing!',
    });
    throw e;
  }

  return new SceneAppPage({
    getParentPage: () => parent,
    getScene: (routeMatch) => getServicesScene(routeMatch),
    layout: PageLayoutType.Custom,
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    routePath: CHILD_ROUTE_DEFINITIONS[slug],
    title: capitalizeFirstLetter(breakdownLabel),
    url: SUB_ROUTES[slug](labelValue, labelName, breakdownLabel),
  });
}
