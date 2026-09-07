import React from 'react';

import { css } from '@emotion/css';

import { AdHocVariableFilter } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Combobox, ComboboxOption, InlineField, Stack, useStyles2 } from '@grafana/ui';

import { getDetectedFieldsFrame, ServiceScene } from 'Components/ServiceScene/ServiceScene';
import { extractParserFromString, getDetectedFieldsNamesField, getDetectedFieldsParserField } from 'services/fields';
import { FIELDS_TO_REMOVE } from 'services/filters';
import { getParserEnabled } from 'services/parserToggle';
import { getDataSource } from 'services/scenes';
import { getLogsVolumeOption } from 'services/store';
import { getAdHocFiltersVariable } from 'services/variableGetters';
import { LEVEL_VARIABLE_VALUE, VAR_LABELS } from 'services/variables';

interface LogsVolumeActionsState extends SceneObjectState {
  aggregateBy: string;
  onAggregateByChange: (field: string) => void;
  options: Array<ComboboxOption<string>>;
}

export class LogsVolumeActions extends SceneObjectBase<LogsVolumeActionsState> {
  static Component = Component;

  constructor(state: Omit<LogsVolumeActionsState, 'options'> & { options?: Array<ComboboxOption<string>> }) {
    super({
      ...state,
      options: state.options ?? [],
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this.updateOptions();
    const detectedFieldsData = serviceScene.state.$detectedFieldsData;
    if (detectedFieldsData) {
      this._subs.add(
        detectedFieldsData.subscribeToState((state) => {
          console.log(state);
          this.updateOptions();
        })
      );
    }
  }

  private updateOptions() {
    this.setState({ options: getAggregateByOptions(this, this.state.aggregateBy) });
  }

  public onChange = (option: ComboboxOption<string> | null) => {
    if (option == null) {
      return;
    }
    this.state.onAggregateByChange(option.value);
  };
}

type StreamSelector = Pick<AdHocVariableFilter, 'key' | 'operator' | 'value'>;

type TemporaryExemptionsProps = {
  /** An ordered list of lower-case [a-z]+ string identifiers to provide context clues of where this component is being embedded and how we might want to consider displaying it */
  contextHints?: string[];
  /** Currently selected data source */
  dataSourceUid?: string;
  /** The stream selector, broken down into a list of structured subselector filter items */
  streamSelector?: StreamSelector[];
};

function Component({ model }: SceneComponentProps<LogsVolumeActions>) {
  const { aggregateBy, options } = model.useState();
  const styles = useStyles2(getStyles);
  const { component: TemporaryExemptionsButton, isLoading } = usePluginComponent<TemporaryExemptionsProps>(
    'grafana-adaptivelogs-app/temporary-exemptions/v1'
  );

  const labelsVar = getAdHocFiltersVariable(VAR_LABELS, model);
  const { filters } = labelsVar.useState();
  const streamSelector = filters.map(({ key, operator, value }: AdHocVariableFilter) => ({ key, operator, value }));

  const dataSourceUid = getDataSource(model);

  const lostVolumeCollapsed = getLogsVolumeOption('collapsed');

  return (
    <Stack alignItems="center" gap={1}>
      {!lostVolumeCollapsed && (
        <InlineField
          className={styles.aggregateByField}
          transparent
          label={t('components.service-scene.logs-volume.logs-volume-actions.label-group-by', 'Group by')}
        >
          <Combobox<string>
            aria-label={t(
              'components.service-scene.logs-volume.logs-volume-actions.aria-label-group-by',
              'Group log volume by field'
            )}
            minWidth={16}
            onChange={model.onChange}
            options={options}
            value={aggregateBy}
            width="auto"
          />
        </InlineField>
      )}
      {!isLoading && TemporaryExemptionsButton && (
        <TemporaryExemptionsButton
          dataSourceUid={dataSourceUid}
          streamSelector={streamSelector}
          contextHints={['explorelogs', 'logvolumepanel', 'headeraction']}
        />
      )}
    </Stack>
  );
}

function getAggregateByOptions(sceneRef: SceneObject, selected: string): Array<ComboboxOption<string>> {
  const detectedFieldsFrame = getDetectedFieldsFrame(sceneRef);
  const namesField = getDetectedFieldsNamesField(detectedFieldsFrame);
  const parserField = getDetectedFieldsParserField(detectedFieldsFrame);
  const parserEnabled = getParserEnabled();
  const names = new Set<string>();

  namesField?.values.forEach((name, index) => {
    const fieldName = String(name);
    if (!fieldName || FIELDS_TO_REMOVE.includes(fieldName)) {
      return;
    }
    if (!parserEnabled) {
      const parser = extractParserFromString(parserField?.values?.[index] ?? '');
      if (parser !== 'structuredMetadata') {
        return;
      }
    }
    names.add(fieldName);
  });

  const options: Array<ComboboxOption<string>> = [
    { label: LEVEL_VARIABLE_VALUE, value: LEVEL_VARIABLE_VALUE },
    ...[...names].sort().map((name) => ({ label: name, value: name })),
  ];

  if (selected && !options.some((option) => option.value === selected)) {
    options.unshift({ label: selected, value: selected });
  }

  return options;
}

const getStyles = () => ({
  aggregateByField: css({
    label: 'logs-volume-aggregate-by',
    marginBottom: 0,
    marginRight: 0,
  }),
});
