import React from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Combobox, ComboboxOption, InlineField, Stack } from '@grafana/ui';

import type { LogsVolumeViewSwitch } from './LogsVolumeViewSwitch';
import { getDetectedFieldsFrame, ServiceScene } from 'Components/ServiceScene/ServiceScene';
import { getFieldOptions } from 'services/fieldExtremes';

interface LogsFieldExtremesActionsState extends SceneObjectState {
  collapsed: boolean;
  field?: string;
  onFieldChange: (field: string) => void;
  options: Array<ComboboxOption<string>>;
  viewSwitch: LogsVolumeViewSwitch;
}

export class LogsFieldExtremesActions extends SceneObjectBase<LogsFieldExtremesActionsState> {
  static Component = Component;

  constructor(state: Omit<LogsFieldExtremesActionsState, 'options'>) {
    super({ ...state, options: [] });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.updateOptions();
    const detectedFieldsData = sceneGraph.getAncestor(this, ServiceScene).state.$detectedFieldsData;
    if (detectedFieldsData) {
      this._subs.add(detectedFieldsData.subscribeToState(() => this.updateOptions()));
    }
  }

  private updateOptions() {
    this.setState({ options: getFieldOptions(getDetectedFieldsFrame(this), this.state.field) });
  }
}

function Component({ model }: SceneComponentProps<LogsFieldExtremesActions>) {
  const { collapsed, field, onFieldChange, options, viewSwitch } = model.useState();

  if (collapsed) {
    return null;
  }

  return (
    <Stack alignItems="center" gap={1}>
      <InlineField transparent label={t('components.service-scene.logs-volume.field-extremes.label-field', 'Field')}>
        <Combobox<string>
          aria-label={t('components.service-scene.logs-volume.field-extremes.aria-label-field', 'Numeric field')}
          minWidth={16}
          onChange={(option) => option && onFieldChange(option.value)}
          options={options}
          placeholder={t('components.service-scene.logs-volume.field-extremes.placeholder', 'Select a numeric field')}
          value={field ?? null}
          width="auto"
        />
      </InlineField>
      <viewSwitch.Component model={viewSwitch} />
    </Stack>
  );
}
