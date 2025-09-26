import { AdHocVariableFilter } from '@grafana/data';
import { SceneObject, SceneObjectState } from '@grafana/scenes';

import { LineFilterType } from '../../services/filterTypes';
import { LokiDatasource } from '../../services/lokiQuery';
import { AppliedPattern } from '../../services/variables';
import { OptionalRouteMatch } from '../Pages';
import { LayoutScene } from './LayoutScene';

export interface IndexSceneState extends SceneObjectState {
  body?: LayoutScene;
  // contentScene is the scene that is displayed in the main body of the index scene - it can be either the service selection or service scene
  contentScene?: SceneObject;
  controls?: SceneObject[];
  currentFiltersMatchReference?: boolean;
  defaultLineFilters?: LineFilterType[];
  ds?: LokiDatasource;
  embedded?: boolean;
  embedderName?: string;
  initialLabels?: AdHocVariableFilter[];
  patterns?: AppliedPattern[];
  referenceLabels?: AdHocVariableFilter[];
  routeMatch?: OptionalRouteMatch;
}
