import { createAssistantContextItem, providePageContext } from '@grafana/assistant';
import { SceneObject } from '@grafana/scenes';

import { getLokiDatasource } from './scenes';
import { getLabelsVariable } from './variableGetters';
import { USER_INPUT_ADHOC_VALUE_PREFIX } from './variables';

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
          labelValue: sanitizeValue(filter.value),
        })
      )
    );
  }

  setAssistantContext(contexts);
};

function sanitizeValue(value: string) {
  return value.replace(USER_INPUT_ADHOC_VALUE_PREFIX, '');
}
