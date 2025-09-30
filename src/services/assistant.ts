import { ChatContextItem, createAssistantContextItem, providePageContext } from '@grafana/assistant';
import { SceneObject } from '@grafana/scenes';

import { getLokiDatasource } from './scenes';
import { getLabelsVariable } from './variableGetters';

export const buildAssistantContext = async (model: SceneObject): Promise<ChatContextItem[]> => {
  const contexts: ChatContextItem[] = [];

  const ds = await getLokiDatasource(model);
  if (!ds) {
    return contexts;
  }

  contexts.push(
    createAssistantContextItem('datasource', {
      datasourceUid: ds.uid,
    })
  );

  const labelsVar = getLabelsVariable(model);
  if (labelsVar.state.filters.length > 0) {
    contexts.push(
      ...labelsVar.state.filters.map((filter) =>
        createAssistantContextItem('label_value', {
          datasourceUid: ds.uid,
          labelName: filter.key,
          labelValue: filter.value,
        })
      )
    );
  }

  return contexts;
};

export const updateAssistantContext = async (
  model: SceneObject,
  setAssistantContext: ReturnType<typeof providePageContext>
) => {
  const contexts = await buildAssistantContext(model);
  if (contexts.length === 0) {
    return;
  }

  setAssistantContext(contexts);
};
