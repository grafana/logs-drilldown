import React from 'react';

import { BusEventBase } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';

import { getDetectedFieldsFrame, ServiceScene } from 'Components/ServiceScene/ServiceScene';
import { getFieldNames } from 'services/fieldExtremes';

export type LogsVolumeView = 'max' | 'min' | 'volume';

export class ChangeLogsVolumeViewEvent extends BusEventBase {
  constructor(public view: LogsVolumeView) {
    super();
  }
  public static type = 'change-logs-volume-view';
}

interface LogsVolumeViewSwitchState extends SceneObjectState {
  hasNumericFields: boolean;
  view: LogsVolumeView;
}

/** Volume | Max | Min radios, one instance in each header since the views share the same space. */
export class LogsVolumeViewSwitch extends SceneObjectBase<LogsVolumeViewSwitchState> {
  static Component = Component;

  constructor(state: Pick<LogsVolumeViewSwitchState, 'view'>) {
    super({ ...state, hasNumericFields: false });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.updateAvailability();
    const detectedFieldsData = sceneGraph.getAncestor(this, ServiceScene).state.$detectedFieldsData;
    if (detectedFieldsData) {
      this._subs.add(detectedFieldsData.subscribeToState(() => this.updateAvailability()));
    }
  }

  private updateAvailability() {
    this.setState({ hasNumericFields: getFieldNames(getDetectedFieldsFrame(this)).numeric.length > 0 });
  }

  public onChange = (view: LogsVolumeView) => {
    this.publishEvent(new ChangeLogsVolumeViewEvent(view), true);
  };
}

function Component({ model }: SceneComponentProps<LogsVolumeViewSwitch>) {
  const { hasNumericFields, view } = model.useState();

  // Nothing to switch to when the logs have no numeric fields.
  if (view === 'volume' && !hasNumericFields) {
    return null;
  }

  return (
    <RadioButtonGroup<LogsVolumeView>
      aria-label={t('components.service-scene.logs-volume.view-switch.aria-label', 'Logs volume view')}
      onChange={model.onChange}
      options={[
        {
          description: t(
            'components.service-scene.logs-volume.view-switch.description-volume',
            'Number of logs over time'
          ),
          label: t('components.service-scene.logs-volume.view-switch.volume', 'Volume'),
          value: 'volume',
        },
        {
          description: t(
            'components.service-scene.logs-volume.view-switch.description-max',
            'Highest value of a field over time'
          ),
          label: t('components.service-scene.logs-volume.view-switch.max', 'Max'),
          value: 'max',
        },
        {
          description: t(
            'components.service-scene.logs-volume.view-switch.description-min',
            'Lowest value of a field over time'
          ),
          label: t('components.service-scene.logs-volume.view-switch.min', 'Min'),
          value: 'min',
        },
      ]}
      size="sm"
      value={view}
    />
  );
}
