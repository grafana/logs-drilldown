import React, { useMemo } from 'react';

import { dateTimeParse, PageLayoutType, TimeRange, urlUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
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

import { plugin } from '../module';
import { PageSlugs, ValueSlugs } from '../services/enums';
import { getKgSceneProps } from '../services/kgAnnotations';
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
  SERVICE_URL_KEYS_NO_TIMERANGE,
  SUB_ROUTES,
} from '../services/routing';
import { capitalizeFirstLetter } from '../services/text';
import { EmbeddedLogsExplorationProps } from './EmbeddedLogsExploration/types';
import { IndexScene } from './IndexScene/IndexScene';
import { IndexSceneState } from './IndexScene/types';

export type RouteProps = { breakdownLabel?: string; labelName: string; labelValue: string };
export type RouteMatch = SceneRouteMatch<RouteProps>;
type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
export type OptionalRouteProps = Optional<RouteProps, 'labelName' | 'labelValue'>;
export type OptionalRouteMatch = SceneRouteMatch<OptionalRouteProps>;

export const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };

function getDefaultTimeRangeFromPlugin(): { from: string; to: string } {
  const { jsonData } = plugin.meta;
  const custom = jsonData?.defaultTimeRange;
  if (custom?.from && custom?.to) {
    return { from: custom.from, to: custom.to };
  }
  return DEFAULT_TIME_RANGE;
}

function getServicesScene(routeMatch: OptionalRouteMatch) {
  const initialTimeRange = getDefaultTimeRangeFromPlugin();
  const kg = getKgSceneProps();
  return new EmbeddedScene({
    ...(kg ? { $data: kg.$data } : {}),
    body: new IndexScene({
      $timeRange: new SceneTimeRange(initialTimeRange),
      routeMatch,
      ...(kg ? { $behaviors: kg.behaviors, kgAnnotationToggle: kg.controls } : {}),
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

  if (isLoading) {
    return <LoadingPlaceholder text={t('components.embedded-scene-wrapper.text-loading', 'Loading...')} />;
  }
  if (Component) {
    return <Component {...props} />;
  }

  console.error(
    'No grafana-lokiexplore-app/embedded-logs-exploration/v1 component found in the Grafana registry! You might need to restart your Grafana instance?'
  );

  return null;
}

function getEmbeddedScene() {
  const initialStart = 'now-15m';
  const initialEnd = 'now';
  const query =
    '{service_name=~"tempo-distributor|tempo-ingester"} | user!="03428" |~ "(?i)Error" | json | logfmt | drop __error__, __error_details__ |  msg!="Failed to get keys from redis"';

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

  const props: EmbeddedLogsExplorationProps & Pick<IndexSceneState, 'embedded'> = {
    embedded: true,
    embedderName: 'EmbeddedLogs',
    options: {
      emptyStates: {
        logs: {
          customPrompt: 'Write a haiku about Loki Logs',
          promptCTA: 'Where are my logs?',
        },
      },
    },
    query,
    timeRangeState: $timeRange.state,
    referenceQuery: query,
  };

  return new EmbeddedScene({
    body: new SceneReactObject({
      component: EmbeddedSceneWrapper,
      props,
    }),
  });
}

export function makeEmbeddedPage() {
  return new SceneAppPage({
    drilldowns: [
      {
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.embed),
        routePath: ROUTE_DEFINITIONS.embed,
      },
    ],
    getScene: (routeMatch) => getEmbeddedScene(),
    layout: PageLayoutType.Custom,
    routePath: `${PageSlugs.embed}`,
    title: t(
      'components.make-embedded-page.title.grafana-logs-drilldown-embedded',
      'Grafana Logs Drilldown — Embedded'
    ),
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
    // Fallback to default time range if configured
    preserveUrlKeys: plugin.meta.jsonData?.defaultTimeRange ? SERVICE_URL_KEYS_NO_TIMERANGE : SERVICE_URL_KEYS,
    routePath: `${PageSlugs.explore}/*`,
    // Top level breadcrumb
    title: t('components.make-index-page.title.grafana-logs-drilldown', 'Grafana Logs Drilldown'),
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
