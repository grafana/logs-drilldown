import React, { useMemo } from 'react';

import { dateTimeParse, PageLayoutType, TimeRange } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { EmbeddedScene, SceneAppPage, SceneReactObject, SceneRouteMatch, SceneTimeRange } from '@grafana/scenes';
import { LoadingPlaceholder } from '@grafana/ui';

import { PageSlugs } from '../services/enums';
import { prefixRoute } from '../services/plugin';
import { ROUTE_DEFINITIONS } from '../services/routing';
import { EmbeddedLogsExplorationProps } from './EmbeddedLogsExploration/types';
import { IndexSceneState } from './IndexScene/types';
import { MiniEmbeddedLogsExplorationProps } from './MiniEmbeddedLogsExploration/types';
import { makeBreakdownPage, RouteMatch } from './Pages';

function EmbeddedSceneWrapper(props: EmbeddedLogsExplorationProps) {
  // Component is always null, doesn't look like we can embed something from the same app?
  const { component: LogsDrilldownComponent, isLoading } = usePluginComponent<EmbeddedLogsExplorationProps>(
    'grafana-lokiexplore-app/embedded-logs-exploration/v1'
  );

  // We don't want to re-render the entire app every time the props change, only once when the plugin component is done loading
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const Component = useMemo(() => LogsDrilldownComponent, [isLoading]);

  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
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
  const query = '{service_name="tempo-distributor"} |~ "(?i)Error"';

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

  const props: EmbeddedLogsExplorationProps & IndexSceneState = {
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

function MiniEmbeddedSceneWrapper(props: MiniEmbeddedLogsExplorationProps) {
  // Component is always null, doesn't look like we can embed something from the same app?
  const { component: LogsDrilldownComponent, isLoading } = usePluginComponent<MiniEmbeddedLogsExplorationProps>(
    'grafana-lokiexplore-app/mini-embedded-logs-exploration/v1'
  );

  // We don't want to re-render the entire app every time the props change, only once when the plugin component is done loading
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const Component = useMemo(() => LogsDrilldownComponent, [isLoading]);

  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }
  if (Component) {
    return <Component {...props} />;
  }

  console.error(
    'No grafana-lokiexplore-app/mini-embedded-logs-exploration/v1 component found in the Grafana registry! You might need to restart your Grafana instance?'
  );

  return null;
}

function getMiniEmbeddedScene() {
  const initialStart = 'now-15m';
  const initialEnd = 'now';
  const query = '{service_name="tempo-distributor"} |~ "(?i)Error"';

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

  const props: EmbeddedLogsExplorationProps & IndexSceneState = {
    embedded: true,
    embedderName: 'EmbeddedLogs',
    query,
    timeRangeState: $timeRange.state,
    referenceQuery: query,
  };

  return new EmbeddedScene({
    body: new SceneReactObject({
      component: MiniEmbeddedSceneWrapper,
      props,
    }),
  });
}

function getRouteScene(routeMatch: SceneRouteMatch) {
  return routeMatch.path.endsWith('/embed') ? getEmbeddedScene() : getMiniEmbeddedScene();
}

export function makeEmbeddedPage() {
  return new SceneAppPage({
    drilldowns: [
      {
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.embed),
        routePath: ROUTE_DEFINITIONS.embed,
      },
    ],
    getScene: (routeMatch) => getRouteScene(routeMatch),
    layout: PageLayoutType.Custom,
    routePath: `${PageSlugs.embed}`,
    title: 'Grafana Logs Drilldown — Embedded',
    url: prefixRoute(PageSlugs.embed),
  });
}

export function makeMiniEmbeddedPage() {
  return new SceneAppPage({
    drilldowns: [
      {
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.miniembed),
        routePath: ROUTE_DEFINITIONS.miniembed,
      },
    ],
    getScene: (routeMatch) => getRouteScene(routeMatch),
    layout: PageLayoutType.Custom,
    routePath: `${PageSlugs.miniembed}`,
    title: 'Grafana Logs Drilldown — Embedded',
    url: prefixRoute(PageSlugs.miniembed),
  });
}
