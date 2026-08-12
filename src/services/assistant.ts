import { createAssistantContextItem, providePageContext, provideQuestions } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { PLUGIN_BASE_URL } from './plugin';
import { interpolateExpression } from './query';
import { getLokiDatasource } from './scenes';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getMetadataVariable,
  getValueFromFieldsFilter,
} from './variableGetters';
import { LOG_STREAM_SELECTOR_EXPR, stripAdHocFilterUserInputPrefix } from './variables';

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
          labelValue: stripAdHocFilterUserInputPrefix(filter.value),
          operator: filter.operator,
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
          operator: filter.operator,
        })
      )
    );
  }

  const metadataVar = getMetadataVariable(model);
  if (metadataVar.state.filters.length > 0) {
    contexts.push(
      ...metadataVar.state.filters.map((filter) => {
        return createAssistantContextItem('structured', {
          title: t(
            'services.update-assistant-context.title.structured-metadata-filters',
            'Structured metadata filters'
          ),
          hidden: true,
          data: {
            datasourceUid: ds.uid,
            fieldName: filter.key,
            fieldValue: stripAdHocFilterUserInputPrefix(filter.value),
            operator: filter.operator,
            instructions:
              'Do not use this in stream selectors, use this with a pipe filter: `| fieldName operator "fieldValue"`',
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
          title: t('services.update-assistant-context.title.parsed-fields-filters', 'Parsed fields filters'),
          hidden: true,
          data: {
            datasourceUid: ds.uid,
            fieldName: filter.key,
            parser: parsedFilter.parser,
            fieldValue: stripAdHocFilterUserInputPrefix(parsedFilter.value),
            operator: filter.operator,
          },
        });
      })
    );
  }

  // No assistant context types exist for time range, line filters, or patterns — ship the rendered query and window instead.
  const timeRange = sceneGraph.getTimeRange(model).state.value;
  contexts.push(
    createAssistantContextItem('structured', {
      title: t(
        'services.update-assistant-context.title.current-logs-query-and-time-range',
        'Current logs query and time range'
      ),
      hidden: true,
      bypassLimits: true,
      data: {
        datasourceUid: ds.uid,
        logqlQuery: interpolateExpression(model, LOG_STREAM_SELECTOR_EXPR),
        timeRangeFromMs: timeRange.from.valueOf(),
        timeRangeToMs: timeRange.to.valueOf(),
        instructions:
          'The exact LogQL query and time range for the logs the user is currently viewing in Logs Drilldown. timeRangeFromMs/timeRangeToMs are unix millisecond timestamps — pass them directly as the start/end parameters of Loki tools without converting them. Prefer this query and time range when reading, querying, or summarizing the logs.',
      },
    })
  );

  setAssistantContext(contexts);
};

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
