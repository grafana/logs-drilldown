import { UrlQueryMap, urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneObject } from '@grafana/scenes';

import { RouteMatch, RouteProps } from '../Components/Pages';
import { PageSlugs, ValueSlugs } from './enums';
import { replaceSlash } from './extensions/links';
import { logger } from './logger';
import { narrowValueSlug } from './narrowing';
import { PLUGIN_BASE_URL, prefixRoute } from './plugin';
import { getLabelsVariable } from './variableGetters';
import {
  SERVICE_NAME,
  SERVICE_UI_LABEL,
  VAR_DATASOURCE,
  VAR_FIELD_GROUP_BY,
  VAR_FIELDS,
  VAR_JSON_FIELDS,
  VAR_LABEL_GROUP_BY,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_LINE_FILTER,
  VAR_LINE_FILTERS,
  VAR_LINE_FORMAT,
  VAR_METADATA,
  VAR_PATTERNS,
} from './variables';

export type ParentDrilldownSlugs =
  | PageSlugs.explore
  | PageSlugs.fields
  | PageSlugs.logs
  | PageSlugs.labels
  | PageSlugs.patterns
  | PageSlugs.embed;
export type ChildDrilldownSlugs = ValueSlugs.field | ValueSlugs.label;

export const ROUTES = {
  embed: () => prefixRoute(PageSlugs.embed),
  explore: () => prefixRoute(PageSlugs.explore),
  fields: (labelValue: string, labelName = 'service') =>
    prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.fields}`),
  labels: (labelValue: string, labelName = 'service') =>
    prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.labels}`),
  logs: (labelValue: string, labelName = 'service') =>
    prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.logs}`),
  patterns: (labelValue: string, labelName = 'service') =>
    prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.patterns}`),
};

export const SUB_ROUTES = {
  field: (labelValue: string, labelName = 'service', breakdownLabelName: string) =>
    prefixRoute(
      `${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${ValueSlugs.field}/${breakdownLabelName}`
    ),
  label: (labelValue: string, labelName = 'service', breakdownLabelName: string) =>
    prefixRoute(
      `${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${ValueSlugs.label}/${breakdownLabelName}`
    ),
};

export const ROUTE_DEFINITIONS: Record<keyof typeof PageSlugs, string> = {
  embed: `${PageSlugs.embed}/*`,
  explore: `${PageSlugs.explore}/*`,
  fields: `:labelName/:labelValue/${PageSlugs.fields}`,
  labels: `:labelName/:labelValue/${PageSlugs.labels}`,
  logs: `:labelName/:labelValue/${PageSlugs.logs}`,
  patterns: `:labelName/:labelValue/${PageSlugs.patterns}`,
};

export const CHILD_ROUTE_DEFINITIONS: Record<keyof typeof ValueSlugs, string> = {
  field: `:labelName/:labelValue/${ValueSlugs.field}/:breakdownLabel`,
  label: `:labelName/:labelValue/${ValueSlugs.label}/:breakdownLabel`,
};

export const EXPLORATIONS_ROUTE = `${PLUGIN_BASE_URL}/${PageSlugs.explore}`;

// For redirect back to service, we just want to keep datasource, and timerange
export const SERVICE_URL_KEYS = ['from', 'to', `var-${VAR_DATASOURCE}`, `var-${VAR_LABELS}`];
//@todo why patterns and var-patterns?
export const DRILLDOWN_URL_KEYS = [
  'from',
  'to',
  'mode',
  'urlColumns',
  'visualizationType',
  'selectedLine',
  'displayedFields',
  'panelState',
  VAR_PATTERNS,
  `var-${VAR_PATTERNS}`,
  `var-${VAR_DATASOURCE}`,
  `var-${VAR_LABELS}`,
  `var-${VAR_FIELDS}`,
  `var-${VAR_LEVELS}`,
  `var-${VAR_FIELD_GROUP_BY}`,
  `var-${VAR_LABEL_GROUP_BY}`,
  `var-${VAR_DATASOURCE}`,
  `var-${VAR_LINE_FILTER}`,
  `var-${VAR_METADATA}`,
  `var-${VAR_LINE_FILTERS}`,
  `var-${VAR_JSON_FIELDS}`,
  `var-${VAR_LINE_FORMAT}`,
];

export function getDrilldownSlug() {
  const location = locationService.getLocation();
  const slug = location.pathname.slice(location.pathname.lastIndexOf('/') + 1, location.pathname.length);
  return slug as PageSlugs;
}

export function getUILabelName(labelName: string) {
  if (labelName === SERVICE_NAME) {
    // Keep urls the same
    labelName = SERVICE_UI_LABEL;
  }
  return labelName;
}

/**
 * The "primary" label, is the replacement for the service_name paradigm
 * It must be an indexed label with an include filter
 * Note: Will return the label as it exists in the url, so "service_name" will be returned as "service", we'll need to adjust for this case if we want to support URLs from before this change
 */
export function getPrimaryLabelFromUrl(): RouteProps {
  const location = locationService.getLocation();
  const startOfUrl = '/a/grafana-lokiexplore-app/explore';
  const startOfUrlIndex = location.pathname.indexOf(startOfUrl);
  if (startOfUrlIndex === -1) {
    throw new Error('Cannot get primary label from URL when embedded!');
  }
  const endOfUrl = location.pathname.slice(startOfUrlIndex + startOfUrl.length + 1);
  const routeParams = endOfUrl.split('/');

  let labelName = routeParams[0];
  const labelValue = routeParams[1];
  const breakdownLabel = routeParams[3];

  console.log('getPrimaryLabelFromUrl', { breakdownLabel, labelName: getUILabelName(labelName), labelValue });

  return { breakdownLabel, labelName: getUILabelName(labelName), labelValue };
}

export function getDrilldownValueSlug() {
  const location = locationService.getLocation();
  const locationArray = location.pathname.split('/');
  return narrowValueSlug(locationArray[locationArray.length - 2]);
}

export function buildServicesUrl(path: string, extraQueryParams?: UrlQueryMap): string {
  return urlUtil.renderUrl(path, buildServicesRoute(extraQueryParams));
}
export function extractValuesFromRoute(routeMatch: RouteMatch): RouteProps {
  return {
    breakdownLabel: routeMatch.params.breakdownLabel,
    labelName: routeMatch.params.labelName,
    labelValue: routeMatch.params.labelValue,
  };
}

export function buildServicesRoute(extraQueryParams?: UrlQueryMap): UrlQueryMap {
  return {
    ...Object.entries(urlUtil.getUrlSearchParams()).reduce<UrlQueryMap>((acc, [key, value]) => {
      if (SERVICE_URL_KEYS.includes(key)) {
        acc[key] = value;
      }

      return acc;
    }, {}),
    ...extraQueryParams,
  };
}

/**
 * Compare slugs against variable filters and log discrepancies
 * These don't cause errors or render empty UIs, but shouldn't be possible when routing within the app
 * If we see these logged in production it indicates we're navigating users incorrectly
 * @param sceneRef
 * @deprecated with embedding we won't have routes, so this warning will fire whenever this is called when embedding
 */
export function checkPrimaryLabel(sceneRef: SceneObject) {
  const labelsVariable = getLabelsVariable(sceneRef);
  let { labelName, labelValue } = getPrimaryLabelFromUrl();
  if (labelName === SERVICE_UI_LABEL) {
    labelName = SERVICE_NAME;
  }
  const primaryLabel = labelsVariable.state.filters.find((filter) => filter.key === labelName);
  if (!primaryLabel) {
    const location = locationService.getLocation();

    logger.info('invalid primary label name in url', {
      labelName,
      url: `${location.pathname}${location.search}`,
    });
  }

  const primaryLabelValue = labelsVariable.state.filters.find((filter) => replaceSlash(filter.value) === labelValue);
  if (!primaryLabelValue) {
    const location = locationService.getLocation();

    logger.info('invalid primary label value in url', {
      labelValue,
      url: `${location.pathname}${location.search}`,
    });
  }
}
