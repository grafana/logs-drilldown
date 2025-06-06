import { urlUtil } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { sceneGraph, SceneObject, SceneObjectUrlValues, SceneQueryRunner, SceneTimePicker } from '@grafana/scenes';

import { logger } from './logger';
import { LokiDatasource } from './lokiQuery';
import { EXPLORATIONS_ROUTE } from './routing';
import {
  LOG_STREAM_SELECTOR_EXPR,
  PRETTY_LOG_STREAM_SELECTOR_EXPR,
  VAR_DATASOURCE_EXPR,
  VAR_LABELS_EXPR,
} from './variables';
import { IndexScene } from 'Components/IndexScene/IndexScene';

export function getExplorationFor(model: SceneObject): IndexScene {
  return sceneGraph.getAncestor(model, IndexScene);
}

export function getUrlForValues(values: SceneObjectUrlValues) {
  return urlUtil.renderUrl(EXPLORATIONS_ROUTE, values);
}

export function getDataSource(sceneObject: SceneObject) {
  return sceneGraph.interpolate(sceneObject, VAR_DATASOURCE_EXPR);
}

export function getQueryExpr(exploration: SceneObject) {
  return sceneGraph.interpolate(exploration, LOG_STREAM_SELECTOR_EXPR).replace(/\s+/g, ' ');
}

export function getPrettyQueryExpr(exploration: SceneObject) {
  return sceneGraph.interpolate(exploration, PRETTY_LOG_STREAM_SELECTOR_EXPR).replace(/\s+/g, ' ');
}

export function getPatternExpr(exploration: SceneObject) {
  return sceneGraph.interpolate(exploration, VAR_LABELS_EXPR).replace(/\s+/g, ' ');
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}

export async function getLokiDatasource(sceneObject: SceneObject) {
  const ds = (await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: sceneObject } })) as
    | LokiDatasource
    | undefined;
  return ds;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function getQueryRunnerFromChildren(sceneObject: SceneObject) {
  return sceneGraph.findDescendents(sceneObject, SceneQueryRunner);
}

interface SceneType<T> extends Function {
  new (...args: never[]): T;
}

export function findObjectOfType<T extends SceneObject>(
  scene: SceneObject,
  check: (obj: SceneObject) => boolean,
  returnType: SceneType<T>
) {
  const obj = sceneGraph.findObject(scene, check);
  if (obj instanceof returnType) {
    return obj;
  } else if (obj !== null) {
    logger.warn(`invalid return type: ${returnType.toString()}`);
  }

  return null;
}

export function getTimePicker(scene: IndexScene) {
  return scene.state.controls?.find((s) => s instanceof SceneTimePicker) as SceneTimePicker;
}
