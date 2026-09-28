import { AdHocFilterWithLabels } from '@grafana/scenes';

import { isFilterMetadata } from './filters';
import { isOperatorInclusive } from './operatorHelpers';
import { filterDissolvingOrGroups, makeOrGroupsContiguous, normalizeOrGroups, OrGroupAccessor } from './orGroups';
import { getOrGroupFromFieldsFilterValue, getValueFromFieldsFilter } from './variableGetters';
import {
  addAdHocFilterUserInputPrefix,
  isAdHocFilterValueUserInput,
  stripAdHocFilterUserInputPrefix,
} from './variables';

// Scenes merges edits into the existing filter, so an OR group kept on the "Fields" filter bar filter survives edits
export type AdHocFilterWithOrGroup = AdHocFilterWithLabels & { orGroup?: number };

// `sameFieldOr` connects standalone filters on the same field, which ExpressionBuilder always joins with `or`
export type FilterConnector = 'and' | 'or' | 'sameFieldOr';

export function getFilterOrGroup(filter: AdHocFilterWithLabels): number | undefined {
  return 'orGroup' in filter && typeof filter.orGroup === 'number' ? filter.orGroup : undefined;
}

export function setFilterOrGroup(filter: AdHocFilterWithLabels, orGroup: number | undefined): AdHocFilterWithOrGroup {
  const next: AdHocFilterWithOrGroup = { ...filter };
  if (orGroup === undefined) {
    delete next.orGroup;
  } else {
    next.orGroup = orGroup;
  }
  return next;
}

const orGroupAccessor: OrGroupAccessor<AdHocFilterWithLabels> = {
  get: getFilterOrGroup,
  set: setFilterOrGroup,
};

export function normalizeFilterOrGroups(filters: AdHocFilterWithLabels[]): AdHocFilterWithLabels[] {
  return normalizeOrGroups(filters, orGroupAccessor);
}

// Mirrors ExpressionBuilder, which joins standalone inclusive filters with the same key and operator using `or`
function isSameFieldOr(previous: AdHocFilterWithLabels, next: AdHocFilterWithLabels) {
  return (
    previous.key === next.key &&
    previous.operator === next.operator &&
    isOperatorInclusive(previous.operator) &&
    isFilterMetadata(previous) === isFilterMetadata(next)
  );
}

/** Returns the connectors between adjacent filters, `connectors[i]` sits between `filters[i]` and `filters[i + 1]` */
export function getFilterConnectors(filters: AdHocFilterWithLabels[]): FilterConnector[] {
  const normalized = normalizeFilterOrGroups(filters);
  const connectors: FilterConnector[] = [];

  for (let index = 1; index < normalized.length; index++) {
    const previous = normalized[index - 1];
    const next = normalized[index];
    if (previous == null || next == null) {
      continue;
    }

    const previousOrGroup = getFilterOrGroup(previous);
    const nextOrGroup = getFilterOrGroup(next);
    if (previousOrGroup !== undefined && previousOrGroup === nextOrGroup) {
      connectors.push('or');
    } else if (previousOrGroup === undefined && nextOrGroup === undefined && isSameFieldOr(previous, next)) {
      connectors.push('sameFieldOr');
    } else {
      connectors.push('and');
    }
  }

  return connectors;
}

/** AND -> OR merges the OR-ed runs on both sides of the connector into one group, OR -> AND splits the group */
export function toggleFilterConnector(
  filters: AdHocFilterWithLabels[],
  connectorIndex: number
): AdHocFilterWithLabels[] {
  const normalized = normalizeFilterOrGroups(filters);
  const connectors = getFilterConnectors(normalized);
  const connector = connectors[connectorIndex];
  const filterBeforeConnector = normalized[connectorIndex];
  if (connector === undefined || connector === 'sameFieldOr' || filterBeforeConnector == null) {
    return filters;
  }

  const newOrGroup = Math.max(0, ...normalized.map((filter) => getFilterOrGroup(filter) ?? 0)) + 1;

  if (connector === 'or') {
    const splitOrGroup = getFilterOrGroup(filterBeforeConnector);
    return normalizeFilterOrGroups(
      normalized.map((filter, index) =>
        index > connectorIndex && getFilterOrGroup(filter) === splitOrGroup
          ? setFilterOrGroup(filter, newOrGroup)
          : filter
      )
    );
  }

  let start = connectorIndex;
  while (start > 0 && connectors[start - 1] !== 'and') {
    start--;
  }
  let end = connectorIndex + 1;
  while (end < connectors.length && connectors[end] !== 'and') {
    end++;
  }

  return normalizeFilterOrGroups(
    normalized.map((filter, index) => (index >= start && index <= end ? setFilterOrGroup(filter, newOrGroup) : filter))
  );
}

/** Moves the OR group into the JSON encoded fields variable value so it is synced to the URL */
export function encodeOrGroupInFieldsFilter(filter: AdHocFilterWithLabels): AdHocFilterWithLabels {
  const orGroup = getFilterOrGroup(filter);
  if (orGroup === undefined) {
    return filter;
  }

  const { parser, value } = getValueFromFieldsFilter(filter);
  const encodedValue = JSON.stringify({ orGroup, parser, value: stripAdHocFilterUserInputPrefix(value) });

  return {
    ...setFilterOrGroup(filter, undefined),
    value: isAdHocFilterValueUserInput(filter.value) ? addAdHocFilterUserInputPrefix(encodedValue) : encodedValue,
  };
}

/** Reverses encodeOrGroupInFieldsFilter */
export function decodeOrGroupFromFieldsFilter(filter: AdHocFilterWithLabels): AdHocFilterWithLabels {
  const orGroup = getOrGroupFromFieldsFilterValue(filter);
  if (orGroup === undefined) {
    return filter;
  }

  const { parser, value } = getValueFromFieldsFilter(filter);
  const decodedValue = parser === 'structuredMetadata' ? value : JSON.stringify({ parser, value });

  return setFilterOrGroup(
    {
      ...filter,
      value: isAdHocFilterValueUserInput(filter.value) ? addAdHocFilterUserInputPrefix(decodedValue) : decodedValue,
    },
    orGroup
  );
}

/** OR groups always go to the fields variable, as they may reference fields that only exist after parsing */
export function splitFieldAndMetadataFilters(filters: AdHocFilterWithLabels[]) {
  const normalized = normalizeFilterOrGroups(filters);
  const isStandaloneMetadata = (filter: AdHocFilterWithLabels) =>
    getFilterOrGroup(filter) === undefined && isFilterMetadata(filter);

  return {
    fieldFilters: normalized.filter((filter) => !isStandaloneMetadata(filter)).map(encodeOrGroupInFieldsFilter),
    metadataFilters: normalized.filter(isStandaloneMetadata),
  };
}

/** Rebuilds the "Fields" filter bar filters from the interpolated variables, keeping OR group members adjacent */
export function joinFieldAndMetadataFilters(
  fieldFilters: AdHocFilterWithLabels[],
  metadataFilters: AdHocFilterWithLabels[]
): AdHocFilterWithLabels[] {
  return makeOrGroupsContiguous(
    [...metadataFilters, ...fieldFilters.map(decodeOrGroupFromFieldsFilter)],
    getFilterOrGroup
  );
}

/** Filters the "Fields" filter bar filters, removing every OR group that loses a member */
export function filterFiltersDissolvingOrGroups(
  filters: AdHocFilterWithLabels[],
  keep: (filter: AdHocFilterWithLabels) => boolean
): AdHocFilterWithLabels[] {
  return filterDissolvingOrGroups(filters, keep, getFilterOrGroup);
}

/** Filters the interpolated fields variable filters, removing every OR group that loses a member */
export function filterFieldsVariableFiltersDissolvingOrGroups(
  filters: AdHocFilterWithLabels[],
  keep: (filter: AdHocFilterWithLabels) => boolean
): AdHocFilterWithLabels[] {
  return filterDissolvingOrGroups(filters, keep, getOrGroupFromFieldsFilterValue);
}
