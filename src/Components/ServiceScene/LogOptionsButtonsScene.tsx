import React, { useMemo } from 'react';

import { shallowCompare } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, Tooltip } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { getNormalizedFieldName, LOG_LINE_BODY_FIELD_NAME } from './LogOptionsScene';
import { LogsListScene } from './LogsListScene';
import { ServiceScene } from './ServiceScene';

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
      {!displayedFieldsIsOnlyLogLine && hasDisplayedFields && !shallowCompare(displayedFields, otelDisplayedFields) && (
        <Tooltip content={`Clear displayed fields: ${displayedFieldsNames}`}>
          <Button size={'sm'} variant="secondary" fill="outline" onClick={model.clearDisplayedFields}>
            Show original log line
          </Button>
        </Tooltip>
      )}
      {hasBackendDisplayedFields && !shallowCompare(displayedFields, backendDisplayedFields) && (
        <Tooltip content={`Show default fields: ${backendFieldsNames}`}>
          <Button size={'sm'} variant="secondary" fill="outline" onClick={model.showBackendFields}>
            Show default fields
          </Button>
        </Tooltip>
      )}
    </>
  );
}
