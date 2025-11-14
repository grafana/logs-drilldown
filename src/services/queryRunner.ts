import { sceneGraph, SceneObject, SceneQueryRunner } from '@grafana/scenes';

import { FieldValuesBreakdownScene } from '../Components/ServiceScene/Breakdowns/FieldValuesBreakdownScene';
import { LabelValuesBreakdownScene } from '../Components/ServiceScene/Breakdowns/LabelValuesBreakdownScene';
import { logger } from './logger';
import { interpolateExpression } from './query';
import { getQueryRunnerFromChildren } from './scenes';

export function getQueryRunnerFromSceneGraph(sceneRef: SceneObject) {
  const $data = sceneGraph.getData(sceneRef);
  let queryRunner = $data instanceof SceneQueryRunner ? $data : getQueryRunnerFromChildren($data)[0];

  // If we don't have a query runner, then our panel is within a SceneCSSGridItem, we need to get the query runner from there
  if (!queryRunner) {
    const breakdownScene = sceneGraph.findObject(
      sceneRef,
      (o) => o instanceof FieldValuesBreakdownScene || o instanceof LabelValuesBreakdownScene
    );
    if (breakdownScene) {
      const queryProvider = sceneGraph.getData(breakdownScene);

      if (queryProvider instanceof SceneQueryRunner) {
        queryRunner = queryProvider;
      } else {
        queryRunner = getQueryRunnerFromChildren(queryProvider)[0];
      }
    } else {
      logger.error(new Error('Unable to locate query runner!'), {
        msg: 'PanelMenu - getExploreLink: Unable to locate query runner!',
      });
    }
  }

  return queryRunner;
}

export const getQueryExpression = (sceneRef: SceneObject) => {
  let queryRunner = getQueryRunnerFromSceneGraph(sceneRef);
  const uninterpolatedExpr: string | undefined = queryRunner.state.queries[0].expr;
  return interpolateExpression(sceneRef, uninterpolatedExpr);
};
