import React, { useEffect, useState } from 'react';

import { AdHocFilterWithLabels, SceneTimeRange, UrlSyncContextProvider } from '@grafana/scenes';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { drilldownLabelUrlKey, pageSlugUrlKey } from '../ServiceScene/ServiceSceneConstants';
import { EmbeddedLogsExplorationProps } from './types';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import initRuntimeDs from 'services/datasource';
import { getMatcherFromQuery } from 'services/logqlMatchers';
import { initializeMetadataService } from 'services/metadata';

export function buildLogsExplorationFromState({
  onTimeRangeChange,
  query,
  referenceQuery,
  timeRangeState,
  ...state
}: EmbeddedLogsExplorationProps) {
  const $timeRange = new SceneTimeRange(timeRangeState);
  $timeRange.subscribeToState((state) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(state.value);
    }
  });

  if (!query) {
    console.error('No query parameter found! Please pass in a valid logQL query string when embedding Logs Drilldown.');

    // Report invalid init
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.embedded_error);
    return null;
  }

  initRuntimeDs();

  const { labelFilters, lineFilters } = getMatcherFromQuery(query);
  const referenceFilters = getMatcherFromQuery(referenceQuery || '');

  const initialLabels: AdHocFilterWithLabels[] = labelFilters.map((filter) => ({
    key: filter.key,
    operator: filter.operator,
    value: filter.value,
  }));

  const referenceLabels: AdHocFilterWithLabels[] = referenceFilters.labelFilters.map((filter) => ({
    key: filter.key,
    operator: filter.operator,
    value: filter.value,
  }));

  // Report valid init
  reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.embedded_init);

  return new IndexScene({
    ...state,
    $timeRange,
    defaultLineFilters: lineFilters,
    embedded: true,
    readOnlyLabelFilters: initialLabels,
    referenceLabels,
  });
}

export const VARIABLE_NAMESPACE = 'ld';

export default function EmbeddedLogsExploration(props: EmbeddedLogsExplorationProps) {
  const [exploration, setExploration] = useState<IndexScene | null>(null);

  useEffect(() => {
    if (!exploration) {
      initializeMetadataService(true);
      setExploration(buildLogsExplorationFromState(props));
    }
  }, [exploration, props]);

  if (!exploration) {
    return null;
  }

  return (
    <UrlSyncContextProvider
      scene={exploration}
      updateUrlOnInit={false}
      createBrowserHistorySteps={true}
      namespace={props.namespace || VARIABLE_NAMESPACE}
      excludeFromNamespace={['from', 'to', 'timezone', drilldownLabelUrlKey, pageSlugUrlKey]}
    >
      <exploration.Component model={exploration} />
    </UrlSyncContextProvider>
  );
}
