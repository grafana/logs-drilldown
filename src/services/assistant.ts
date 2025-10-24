import { createAssistantContextItem, providePageContext } from '@grafana/assistant';
import { SceneObject } from '@grafana/scenes';

import { FilterOp } from './filterTypes';
import { getLokiDatasource } from './scenes';
import { getFieldsVariable, getLabelsVariable, getLevelsVariable, getValueFromFieldsFilter } from './variableGetters';
import { stripAdHocFilterUserInputPrefix, USER_INPUT_ADHOC_VALUE_PREFIX } from './variables';

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
          labelValue: `${inequalityPrefix(filter.operator)}${stripAdHocFilterUserInputPrefix(filter.value)}`,
        })
      )
    );
  }

  const levelsVar = getLevelsVariable(model);
  if (levelsVar.state.filters.length > 0) {
    contexts.push(
      ...levelsVar.state.filters.map((filter) =>
        createAssistantContextItem('label_value', {
          datasourceUid: ds.uid,
          labelName: filter.key,
          labelValue: filter.value,
        })
      )
    );
  }

  const fieldsVar = getFieldsVariable(model);
  if (fieldsVar.state.filters.length > 0) {
    contexts.push(
      ...fieldsVar.state.filters.map((filter) =>
        createAssistantContextItem('structured', {
          title: 'Field filters',
          hidden: true,
          data: {
            datasourceUid: ds.uid,
            fieldName: filter.key,
            fieldValue: `${inequalityPrefix(filter.operator)}${stripAdHocFilterUserInputPrefix(
              getValueFromFieldsFilter(filter).value
            )}`,
          },
        })
      )
    );
  }

  setAssistantContext(contexts);
};

function inequalityPrefix(operator: string) {
  return operator !== FilterOp.Equal ? operator : '';
}
