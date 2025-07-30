import { createContext as createAssistantContext, ItemDataType, providePageContext } from '@grafana/assistant';
import { SceneObject } from '@grafana/scenes';

import { getLokiDatasource } from './scenes';
import { getLabelsVariable } from './variableGetters';

export const updateAssistantContext = async (
  model: SceneObject,
  setAssistantContext: ReturnType<typeof providePageContext>
) => {
  const contexts = [];

  const ds = await getLokiDatasource(model);
  if (!ds) {
    return;
  }

  contexts.push(
    createAssistantContext(ItemDataType.Datasource, {
      datasourceName: ds.name,
      datasourceUid: ds.uid,
      datasourceType: ds.type,
    })
  );

  const labelsVar = getLabelsVariable(model);
  if (labelsVar.state.filters.length > 0) {
    contexts.push(
      ...labelsVar.state.filters.map((filter) =>
        createAssistantContext(ItemDataType.LabelValue, {
          datasourceUid: ds.uid,
          datasourceType: ds.type,
          labelName: filter.key,
          labelValue: filter.value,
        })
      )
    );
  }

  setAssistantContext(contexts);
};
