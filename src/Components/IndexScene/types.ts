import { AdHocVariableFilter } from '@grafana/data';
import { SceneObject, SceneObjectState, SceneQueryRunner } from '@grafana/scenes';

import { LokiConfig, LokiConfigNotSupported } from '../../services/datasourceTypes';
import { LineFilterType } from '../../services/filterTypes';
import { LokiDatasource } from '../../services/lokiQuery';
import { AppliedPattern } from '../../services/variables';
import { OptionalRouteMatch } from '../Pages';
import { LayoutScene } from './LayoutScene';
import { EmbeddedLogsOptions } from 'Components/EmbeddedLogsExploration/types';

export interface IndexSceneState extends SceneObjectState {
  $lokiConfig: SceneQueryRunner;
  body?: LayoutScene;
  // contentScene is the scene that is displayed in the main body of the index scene - it can be either the service selection or service scene
  contentScene?: SceneObject;
  controls?: SceneObject[];
  currentFiltersMatchReference?: boolean;
  defaultLineFilters?: LineFilterType[];
  ds?: LokiDatasource;
  embedded?: boolean;
  embeddedOptions?: EmbeddedLogsOptions;
  embedderName?: string;
  initialLabels?: AdHocVariableFilter[];
  // A LokiConfigNotSupported response indicates the Loki instance does not support the new config endpoint, and is probably < 3.6
  lokiConfig?: LokiConfig | LokiConfigNotSupported;
  patterns?: AppliedPattern[];
  referenceLabels?: AdHocVariableFilter[];
  routeMatch?: OptionalRouteMatch;
}
