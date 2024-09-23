import {PluginExtensionLinkConfig, PluginExtensionPanelContext, PluginExtensionPoints} from '@grafana/data';
import {LabelType} from 'services/fields';
import {getMatcherFromQuery} from 'services/logql';

import {LokiQuery} from 'services/query';
import {appendUrlParameter, createAppUrl, replaceSlash, setUrlParameter, UrlParameters} from 'services/routing';
import {SERVICE_NAME} from 'services/variables';
import {FilterOp} from "../filters";

const title = 'Open in Explore Logs';
const description = 'Open current query in the Explore Logs view';
const icon = 'gf-logs';

export const linkConfigs: PluginExtensionLinkConfig[] = [
  {
    extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
    title,
    description,
    icon,
    path: createAppUrl(),
    configure: contextToLink,
  } as PluginExtensionLinkConfig,
  {
    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
    title,
    description,
    icon,
    path: createAppUrl(),
    configure: contextToLink,
  } as PluginExtensionLinkConfig,
];

function contextToLink<T extends PluginExtensionPanelContext>(context?: T) {
  if (!context) {
    return undefined;
  }
  const lokiQuery = context.targets.find((target) => target.datasource?.type === 'loki') as LokiQuery | undefined;
  if (!lokiQuery || !lokiQuery.datasource?.uid) {
    return undefined;
  }

  const expr = lokiQuery.expr;
  const labelFilters = getMatcherFromQuery(expr);
  const labelSelector = labelFilters.find((selector) => selector.key === SERVICE_NAME) ?? labelFilters.find((selector) => selector.operator === FilterOp.Equal) ;
  if (!labelSelector) {
    return undefined;
  }
  const labelName = replaceSlash(labelSelector.value);
  // sort `service_name` first
  labelFilters.sort((a, b) => (a.key === SERVICE_NAME ? -1 : 1));

  let params = setUrlParameter(UrlParameters.DatasourceId, lokiQuery.datasource?.uid);
  params = setUrlParameter(UrlParameters.TimeRangeFrom, context.timeRange.from.valueOf().toString(), params);
  params = setUrlParameter(UrlParameters.TimeRangeTo, context.timeRange.to.valueOf().toString(), params);

  for (const labelFilter of labelFilters) {
    // skip non-indexed filters for now
    if (labelFilter.type !== LabelType.Indexed) {
      continue;
    }

    params = appendUrlParameter(
      UrlParameters.Labels,
      `${labelFilter.key}|${labelFilter.operator}|${labelFilter.value}`,
      params
    );
  }

  console.log('path', createAppUrl(`/explore/${labelSelector.key}/${labelName}/logs`, params))

  return {
    path: createAppUrl(`/explore/${labelSelector.key}/${labelName}/logs`, params),
  };
}
