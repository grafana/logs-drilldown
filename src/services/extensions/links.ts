import { PluginExtensionLinkConfig, PluginExtensionPanelContext, PluginExtensionPoints } from '@grafana/data';

import { SERVICE_NAME, VAR_DATASOURCE, VAR_FIELDS, VAR_LABELS } from 'services/variables';
import pluginJson from '../../plugin.json';
import { LokiQuery } from '../lokiQuery';
import { getMatcherFromQuery } from '../logqlMatchers';
import { LabelType } from '../fieldsTypes';

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
  const serviceSelector = labelFilters.find((selector) => selector.key === SERVICE_NAME);
  if (!serviceSelector) {
    return undefined;
  }
  const serviceName = serviceSelector.value;
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

  return {
    path: createAppUrl(`/explore/service/${serviceName}/logs`, params),
  };
}

export function createAppUrl(path = '/explore', urlParams?: URLSearchParams): string {
  return `/a/${pluginJson.id}${path}${urlParams ? `?${urlParams.toString()}` : ''}`;
}

export const UrlParameters = {
  DatasourceId: `var-${VAR_DATASOURCE}`,
  TimeRangeFrom: 'from',
  TimeRangeTo: 'to',
  Labels: `var-${VAR_LABELS}`,
  Fields: `var-${VAR_FIELDS}`,
} as const;
export type UrlParameterType = (typeof UrlParameters)[keyof typeof UrlParameters];

export function setUrlParameter(key: UrlParameterType, value: string, initalParams?: URLSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams(initalParams?.toString() ?? location.search);
  searchParams.set(key, value);

  return searchParams;
}

export function appendUrlParameter(
  key: UrlParameterType,
  value: string,
  initalParams?: URLSearchParams
): URLSearchParams {
  const searchParams = new URLSearchParams(initalParams?.toString() ?? location.search);
  searchParams.append(key, value);

  return searchParams;
}
