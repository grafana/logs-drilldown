import { createAssistantContextItem, providePageContext, provideQuestions } from '@grafana/assistant';
import { SceneObject } from '@grafana/scenes';

import { FilterOp } from './filterTypes';
import { PLUGIN_BASE_URL } from './plugin';
import { getLokiDatasource } from './scenes';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getMetadataVariable,
  getValueFromFieldsFilter,
} from './variableGetters';
import { stripAdHocFilterUserInputPrefix } from './variables';

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

  const metadataVar = getMetadataVariable(model);
  if (metadataVar.state.filters.length > 0) {
    contexts.push(
      ...metadataVar.state.filters.map((filter) => {
        return createAssistantContextItem('structured', {
          title: 'Structured metadata filters',
          hidden: true,
          data: {
            datasourceUid: ds.uid,
            fieldName: filter.key,
            fieldValue: `${inequalityPrefix(filter.operator)}${stripAdHocFilterUserInputPrefix(filter.value)}`,
          },
        });
      })
    );
  }

  const fieldsVar = getFieldsVariable(model);
  if (fieldsVar.state.filters.length > 0) {
    contexts.push(
      ...fieldsVar.state.filters.map((filter) => {
        const parsedFilter = getValueFromFieldsFilter(filter);
        return createAssistantContextItem('structured', {
          title: 'Parsed fields filters',
          hidden: true,
          data: {
            datasourceUid: ds.uid,
            fieldName: filter.key,
            parser: parsedFilter.parser,
            fieldValue: `${inequalityPrefix(filter.operator)}${stripAdHocFilterUserInputPrefix(parsedFilter.value)}`,
          },
        });
      })
    );
  }

  setAssistantContext(contexts);
};

function inequalityPrefix(operator: string) {
  return operator !== FilterOp.Equal ? operator : '';
}

export function provideServiceSelectionQuestions() {
  return provideQuestions(`${PLUGIN_BASE_URL}/**`, [
    {
      prompt: 'How do I select the right service to see logs?',
    },
    {
      prompt: 'Help me find labels with error spikes',
    },
  ]);
}

export function provideServiceBreakdownQuestions() {
  return provideQuestions(`${PLUGIN_BASE_URL}/**`, [
    {
      prompt: 'Find the root cause of recent errors',
    },
    {
      prompt: 'Detect spikes or anomalies in log volume',
    },
    {
      prompt: "Summarize what's been happening lately",
    },
  ]);
}
