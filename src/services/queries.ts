import { LoadingState } from '@grafana/data';
import { sceneGraph, SceneObject, SceneQueryRunner } from '@grafana/scenes';

export function cancelInFlightQueries(sceneRef: SceneObject) {
  const queryRunners = sceneGraph.findDescendents(sceneRef, SceneQueryRunner);
  for (const queryRunner of queryRunners) {
    if (
      queryRunner.state.data?.state === LoadingState.Loading ||
      queryRunner.state.data?.state === LoadingState.Streaming
    ) {
      queryRunner.cancelQuery();
    }
  }
}
