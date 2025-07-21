import { sceneGraph, SceneObject } from '@grafana/scenes';

import {
  addToFilters,
  FilterType,
  InterpolatedFilterType,
} from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { JSONLogsScene } from '../Components/ServiceScene/JSONLogsScene';
import { LogsListScene } from '../Components/ServiceScene/LogsListScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from './analytics';
import { addJsonParserFieldValue } from './filters';
import { LABEL_NAME_INVALID_CHARS } from './labels';
import { addCurrentUrlToHistory } from './navigate';
import { KeyPath } from '@gtk-grafana/react-json-tree';

interface JsonFilterProps {
  filterType: FilterType;
  key: string;
  keyPath: KeyPath;
  logsJsonScene: JSONLogsScene;
  value: string;
  variableType: InterpolatedFilterType;
}

export const addJSONFieldFilter = ({
  key,
  keyPath,
  value,
  filterType,
  logsJsonScene,
  variableType,
}: JsonFilterProps) => {
  addCurrentUrlToHistory();
  // https://grafana.com/docs/loki/latest/get-started/labels/#label-format
  key = key.replace(LABEL_NAME_INVALID_CHARS, '_');

  addJsonParserFieldValue(logsJsonScene, keyPath);

  const logsListScene = sceneGraph.getAncestor(logsJsonScene, LogsListScene);
  addToFilters(key, value, filterType, logsListScene, variableType, false, true);

  reportAppInteraction(
    USER_EVENTS_PAGES.service_details,
    USER_EVENTS_ACTIONS.service_details.add_to_filters_in_json_panel,
    {
      action: filterType,
      filterType: 'json',
      key,
    }
  );
};

interface NestedNodeFilterProps {
  filterType: FilterType;
  label: string;
  sceneRef: SceneObject;
  value: string;
  variableType: InterpolatedFilterType;
}

export const addJSONMetadataFilter = ({ label, value, filterType, variableType, sceneRef }: NestedNodeFilterProps) => {
  addCurrentUrlToHistory();
  addToFilters(label, value, filterType, sceneRef, variableType, false);
  reportAppInteraction(
    USER_EVENTS_PAGES.service_details,
    USER_EVENTS_ACTIONS.service_details.add_to_filters_in_json_panel,
    {
      action: filterType,
      filterType,
      label: label,
    }
  );
};
