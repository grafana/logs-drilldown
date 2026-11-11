import React, { useMemo } from 'react';

import { LogsSortOrder, shallowCompare } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, Tooltip } from '@grafana/ui';

import { LogsListScene } from './LogsListScene';
import { LogsPanelScene } from './LogsPanelScene';
import { ServiceScene } from './ServiceScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getNormalizedFieldName, LOG_LINE_BODY_FIELD_NAME } from 'services/logFieldNames';
import { getBooleanLogOption, getLogOption, resetLogOptionsToDefaults } from 'services/store';
import { testIds } from 'services/testIds';

interface ShowDefaultFieldsButtonSceneState extends SceneObjectState {}
export class LogOptionsButtonsScene extends SceneObjectBase<ShowDefaultFieldsButtonSceneState> {
  static Component = ShowDefaultFieldsButtonRenderer;

  getLogsListScene = () => {
    return sceneGraph.getAncestor(this, LogsListScene);
  };

  showBackendFields = () => {
    const parentScene = this.getLogsListScene();
    parentScene.showBackendFields();
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_show_backend_fields
    );
  };

  resetLogOptions = () => {
    resetLogOptionsToDefaults();
    const options = {
      fontSize: getLogOption<'default' | 'small'>('fontSize', 'default'),
      showTime: getBooleanLogOption('showTime', true),
      sortOrder: getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending),
      wrapLogMessage: getBooleanLogOption('wrapLogMessage', false),
    };
    const listScene = this.getLogsListScene();
    const panelScene = sceneGraph.findObject(this, (o) => o instanceof LogsPanelScene);
    if (panelScene instanceof LogsPanelScene) {
      panelScene.setState({
        sortOrder: options.sortOrder,
        wrapLogMessage: options.wrapLogMessage,
      });
    }
    listScene.setLogsVizOption(options);
  };

  clearDisplayedFields = () => {
    const parentScene = this.getLogsListScene();
    parentScene.clearDisplayedFields();
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_clear_displayed_fields
    );
  };
}

function ShowDefaultFieldsButtonRenderer({ model }: SceneComponentProps<LogOptionsButtonsScene>) {
  const serviceScene = sceneGraph.getAncestor(model, ServiceScene);
  const { backendDisplayedFields } = serviceScene.useState();
  const { displayedFields, otelDisplayedFields } = model.getLogsListScene().useState();

  const displayedFieldsNames = useMemo(() => displayedFields.map(getNormalizedFieldName).join(', '), [displayedFields]);
  const backendFieldsNames = useMemo(
    () => backendDisplayedFields?.map(getNormalizedFieldName).join(', '),
    [backendDisplayedFields]
  );

  const hasDisplayedFields = displayedFields.length > 0;
  const hasBackendDisplayedFields = backendDisplayedFields && backendDisplayedFields?.length > 0;
  const displayedFieldsIsOnlyLogLine =
    !hasDisplayedFields || (displayedFields.length === 1 && displayedFields[0] === LOG_LINE_BODY_FIELD_NAME);

  return (
    <>
      <Tooltip
        content={t(
          'components.service-scene.log-options-buttons-scene.tooltip.reset-log-options',
          'Reset wrapping, timestamps, font size and sort order to the defaults set by your admin'
        )}
      >
        <Button
          size={'sm'}
          variant="secondary"
          fill="outline"
          data-testid={testIds.logsPanelHeader.resetLogOptions}
          onClick={model.resetLogOptions}
        >
          <Trans i18nKey="components.service-scene.log-options-buttons-scene.reset-log-options">
            Reset to defaults
          </Trans>
        </Button>
      </Tooltip>
      {!displayedFieldsIsOnlyLogLine && hasDisplayedFields && !shallowCompare(displayedFields, otelDisplayedFields) && (
        <Tooltip
          content={t(
            'components.service-scene.log-options-buttons-scene.tooltip.clear-displayed-fields',
            'Clear displayed fields: {{fields}}',
            { fields: displayedFieldsNames }
          )}
        >
          <Button size={'sm'} variant="secondary" fill="outline" onClick={model.clearDisplayedFields}>
            <Trans i18nKey="components.service-scene.log-options-buttons-scene.show-original-log-line">
              Show original log line
            </Trans>
          </Button>
        </Tooltip>
      )}
      {hasBackendDisplayedFields && !shallowCompare(displayedFields, backendDisplayedFields) && (
        <Tooltip
          content={t(
            'components.service-scene.log-options-buttons-scene.tooltip.show-default-fields',
            'Show default fields: {{fields}}',
            {
              fields: backendFieldsNames,
            }
          )}
        >
          <Button size={'sm'} variant="secondary" fill="outline" onClick={model.showBackendFields}>
            <Trans i18nKey="components.service-scene.log-options-buttons-scene.show-default-fields">
              Show default fields
            </Trans>
          </Button>
        </Tooltip>
      )}
    </>
  );
}
