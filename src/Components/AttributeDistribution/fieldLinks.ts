// TODO: The URL-building logic here overlaps with contextToLink in services/extensions/links.ts.
// Both parse a Loki query to extract the service slug and build base URL params.
// They cannot be unified yet because contextToLink takes a PluginExtensionPanelContext
// (with template variable interpolation and scopedVars) while these functions take an
// already-interpolated query string. If the input types are ever aligned, the shared
// base logic could be extracted to links.ts and reused by both.

import { isOperatorInclusive } from '../../services/operatorHelpers';
import { ensureValidTimeRangeForLink } from '../../services/text';
import { SERVICE_NAME } from '../../services/variables';
import {
  createAppUrl,
  escapePrimaryLabel,
  setUrlParameter,
  setUrlParamsFromLabelFilters,
  UrlParameters,
} from '../../services/extensions/links';
import { getMatcherFromQuery } from '../../services/logqlMatchers';

// Resolves the service slug and base URL params from a fully-interpolated Loki query.
// Returns undefined when the query has no inclusive label selector (cannot determine service).
function resolveServiceBase(
  query: string,
  datasourceUid: string,
  timeRangeMs: { from: number; to: number }
): { labelName: string; labelValue: string; params: URLSearchParams } | undefined {
  const { labelFilters } = getMatcherFromQuery(query);
  const labelSelector = labelFilters.find((selector) => isOperatorInclusive(selector.operator));
  if (!labelSelector) {
    return undefined;
  }

  const urlLabelValue = labelSelector.value.split('|')[0];
  const labelValue = escapePrimaryLabel(urlLabelValue);
  const labelName = labelSelector.key === SERVICE_NAME ? 'service' : labelSelector.key;

  const [from, to] = ensureValidTimeRangeForLink(timeRangeMs.from, timeRangeMs.to);
  let params = setUrlParameter(UrlParameters.DatasourceId, datasourceUid, new URLSearchParams());
  params = setUrlParameter(UrlParameters.TimeRangeFrom, from.toString(), params);
  params = setUrlParameter(UrlParameters.TimeRangeTo, to.toString(), params);
  params = setUrlParamsFromLabelFilters(labelFilters, params);

  return { labelName, labelValue, params };
}

// Builds a URL to the Logs Drilldown field distribution tab for a given field.
export function buildFieldLinkFromQuery(
  query: string,
  datasourceUid: string,
  timeRangeMs: { from: number; to: number },
  fieldName: string
): string | undefined {
  const base = resolveServiceBase(query, datasourceUid, timeRangeMs);
  if (!base) {
    return undefined;
  }
  return createAppUrl(`/explore/${base.labelName}/${base.labelValue}/field/${escapePrimaryLabel(fieldName)}`, base.params);
}

// Builds a URL to the Logs Drilldown logs tab for the service derived from the query.
export function buildServiceLinkFromQuery(
  query: string,
  datasourceUid: string,
  timeRangeMs: { from: number; to: number }
): string | undefined {
  const base = resolveServiceBase(query, datasourceUid, timeRangeMs);
  if (!base) {
    return undefined;
  }
  return createAppUrl(`/explore/${base.labelName}/${base.labelValue}/logs`, base.params);
}
