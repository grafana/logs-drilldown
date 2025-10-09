import { sceneGraph, SceneObject } from '@grafana/scenes';

import { EmptyStateOptions } from 'Components/EmbeddedLogsExploration/types';
import { IndexScene } from 'Components/IndexScene/IndexScene';

export function isEmbeddedLogs(sceneRef: SceneObject) {
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  return Boolean(indexScene?.state.embedded);
}

export function getEmptyStateOptions(
  state: 'fields' | 'labels' | 'logs',
  sceneRef: SceneObject
): EmptyStateOptions | undefined {
  if (!isEmbeddedLogs(sceneRef)) {
    return undefined;
  }
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  return indexScene?.state.embeddedOptions?.emptyStates?.[state];
}
