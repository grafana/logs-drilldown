import React, { useEffect, useState } from 'react';
import { AdHocFilterWithLabels, sceneGraph, SceneTimeRange } from '@grafana/scenes';

import { IndexScene } from 'Components/IndexScene/IndexScene';
import { EmbeddedLogsExplorationProps } from './types';
import { initializeMetadataService } from 'services/metadata';
import { getMatcherFromQuery } from 'services/logqlMatchers';

import initRuntimeDs from 'services/datasource';
import { LEVEL_VARIABLE_VALUE, LOG_STREAM_SELECTOR_EXPR } from '../../services/variables';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
  getMetadataVariable,
} from '../../services/variableGetters';
import { areArraysEqual } from '../../services/comparison';
import { FieldFilter } from '../../services/filterTypes';

function buildLogsExplorationFromState({
  timeRangeState,
  onTimeRangeChange,
  query,
  onQueryChange,
  ...state
}: EmbeddedLogsExplorationProps) {
  const $timeRange = new SceneTimeRange(timeRangeState);
  $timeRange.subscribeToState((state) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(state.value);
    }
  });

  if (!query) {
    return null;
  }

  initRuntimeDs();

  const { labelFilters, fields, lineFilters } = getMatcherFromQuery(query);

  const initialLabels: AdHocFilterWithLabels[] = labelFilters.map((filter) => ({
    key: filter.key,
    value: filter.value,
    operator: filter.operator,
  }));

  const initialFields: AdHocFilterWithLabels[] =
    fields
      ?.filter((f) => f.parser !== 'structuredMetadata' && f.key !== LEVEL_VARIABLE_VALUE)
      .map((f) => ({
        key: f.key,
        keyValue: f.key,
        valueLabels: [f.value],
        operator: f.operator,
        value: JSON.stringify({
          value: f.value,
          parser: f.parser,
        }),
      })) ?? [];

  const initialMetadata: FieldFilter[] =
    fields
      ?.filter((f) => f.parser === 'structuredMetadata' && f.key !== LEVEL_VARIABLE_VALUE)
      .map((f) => ({
        key: f.key,
        operator: f.operator,
        value: f.value,
        keyValue: f.key,
        valueLabels: [f.value],
      })) ?? [];

  const initialLevels =
    fields
      ?.filter((f) => f.key === LEVEL_VARIABLE_VALUE)
      .map((f) => ({
        key: f.key,
        operator: f.operator,
        value: f.value,
        keyValue: f.key,
        valueLabels: [f.value],
      })) ?? [];

  const initialLineFilters =
    lineFilters?.map((f) => ({
      key: f.key,
      operator: f.operator,
      value: f.value,
      keyValue: f.key,
      valueLabels: [f.value],
    })) ?? [];

  const indexScene = new IndexScene({
    ...state,
    $timeRange,
    initialFilters: { initialLabels, initialFields, initialMetadata, initialLevels, initialLineFilters },
    embedded: true,
  });

  indexScene.addActivationHandler(() => {
    const serviceScene = indexScene.state.contentScene;
    serviceScene?.addActivationHandler(() => {
      if (serviceScene && serviceScene.isActive) {
        const $data = sceneGraph.getData(serviceScene);
        const levelsVar = getLevelsVariable(serviceScene);
        levelsVar.subscribeToState((newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            const expr = sceneGraph.interpolate($data, LOG_STREAM_SELECTOR_EXPR);
            if (query !== expr) {
              onQueryChange(expr);
            }
          }
        });

        const labelsVar = getLabelsVariable(serviceScene);
        labelsVar.subscribeToState((newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            const expr = sceneGraph.interpolate($data, LOG_STREAM_SELECTOR_EXPR);
            if (query !== expr) {
              onQueryChange(expr);
            }
          }
        });

        const fieldsVar = getFieldsVariable(serviceScene);
        fieldsVar.subscribeToState((newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            const expr = sceneGraph.interpolate($data, LOG_STREAM_SELECTOR_EXPR);
            if (query !== expr) {
              onQueryChange(expr);
            }
          }
        });

        const metaDataVar = getMetadataVariable(serviceScene);
        metaDataVar.subscribeToState((newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            const expr = sceneGraph.interpolate($data, LOG_STREAM_SELECTOR_EXPR);
            if (query !== expr) {
              onQueryChange(expr);
            }
          }
        });

        const lineFiltersVar = getLineFiltersVariable(serviceScene);
        lineFiltersVar.subscribeToState((newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            const expr = sceneGraph.interpolate($data, LOG_STREAM_SELECTOR_EXPR);
            if (query !== expr) {
              onQueryChange(expr);
            }
          }
        });
      }
    });
  });

  return indexScene;
}

export default function EmbeddedLogsExploration(props: EmbeddedLogsExplorationProps) {
  const [exploration, setExploration] = useState<IndexScene | null>(null);

  useEffect(() => {
    if (!exploration) {
      initializeMetadataService();
      setExploration(buildLogsExplorationFromState(props));
    }
  }, [exploration, props]);

  if (!exploration) {
    return null;
  }

  return <exploration.Component model={exploration} />;
}
