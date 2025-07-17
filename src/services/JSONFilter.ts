import { sceneGraph } from '@grafana/scenes';

import {
  addToFilters,
  FilterType,
  InterpolatedFilterType,
} from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { LogsJsonScene } from '../Components/ServiceScene/LogsJsonScene';
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
  logsJsonScene: LogsJsonScene;
  value: string;
  variableType: InterpolatedFilterType;
}

export const addJsonFilter = ({ key, keyPath, value, filterType, logsJsonScene, variableType }: JsonFilterProps) => {
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
  fullKeyPath: string;
  logsListScene: LogsListScene;
  value: string;
  variableType: InterpolatedFilterType;
}

export const addNestedNodeFilter = ({
  fullKeyPath,
  value,
  filterType,
  variableType,
  logsListScene,
}: NestedNodeFilterProps) => {
  addCurrentUrlToHistory();
  addToFilters(fullKeyPath, value, filterType, logsListScene, variableType, false);
  reportAppInteraction(
    USER_EVENTS_PAGES.service_details,
    USER_EVENTS_ACTIONS.service_details.add_to_filters_in_json_panel,
    {
      action: filterType,
      filterType,
      fullKeyPath,
    }
  );
};
