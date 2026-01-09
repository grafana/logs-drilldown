import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { InlineField, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import { narrowLogsSortOrder } from '../../services/narrowing';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { LogOptionsButtonsScene } from './LogOptionsButtonsScene';
import { LogsListScene } from './LogsListScene';
import { LogsPanelScene } from './LogsPanelScene';
import { logsControlsSupported } from 'services/panel';
import { LogsVisualizationType, setLogOption } from 'services/store';

interface LogOptionsState extends SceneObjectState {
  buttonRendererScene?: LogOptionsButtonsScene;
  onChangeVisualizationType: (type: LogsVisualizationType) => void;
  visualizationType: LogsVisualizationType;
}

/**
 * The options rendered in the logs panel header
 */
export class LogOptionsScene extends SceneObjectBase<LogOptionsState> {
  static Component = LogOptionsRenderer;

  constructor(state: LogOptionsState) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.setState({
      buttonRendererScene: new LogOptionsButtonsScene({}),
    });
  }

  handleWrapLinesChange = (type: boolean) => {
    this.getLogsPanelScene().setState({ prettifyLogMessage: type, wrapLogMessage: type });
    setLogOption('wrapLogMessage', type);
    setLogOption('prettifyLogMessage', type);
    this.getLogsListScene().setLogsVizOption({ prettifyLogMessage: type, wrapLogMessage: type });
  };

  onChangeLogsSortOrder = (sortOrder: LogsSortOrder) => {
    this.getLogsPanelScene().setState({ sortOrder: sortOrder });
    setLogOption('sortOrder', sortOrder);
    this.getLogsListScene().setLogsVizOption({ sortOrder: sortOrder });
  };

  getLogsListScene = () => {
    return sceneGraph.getAncestor(this, LogsListScene);
  };

  getLogsPanelScene = () => {
    return sceneGraph.getAncestor(this, LogsPanelScene);
  };
}

function LogOptionsRenderer({ model }: SceneComponentProps<LogOptionsScene>) {
  const { onChangeVisualizationType, visualizationType, buttonRendererScene } = model.useState();
  const { sortOrder, wrapLogMessage } = model.getLogsPanelScene().useState();
  const styles = useStyles2(getStyles);
  const wrapLines = wrapLogMessage ?? false;

  return (
    <div className={styles.container}>
      {buttonRendererScene && <buttonRendererScene.Component model={buttonRendererScene} />}
      {!logsControlsSupported && (
        <>
          <InlineField className={styles.buttonGroupWrapper} transparent>
            <RadioButtonGroup
              size="sm"
              options={[
                {
                  description: 'Show results newest to oldest',
                  label: 'Newest first',
                  value: LogsSortOrder.Descending,
                },
                {
                  description: 'Show results oldest to newest',
                  label: 'Oldest first',
                  value: LogsSortOrder.Ascending,
                },
              ]}
              value={sortOrder}
              onChange={model.onChangeLogsSortOrder}
            />
          </InlineField>
          <InlineField className={styles.buttonGroupWrapper} transparent>
            <RadioButtonGroup
              size="sm"
              value={wrapLines}
              onChange={model.handleWrapLinesChange}
              options={[
                {
                  description: 'Enable wrapping of long log lines',
                  label: 'Wrap',
                  value: true,
                },
                {
                  description: 'Disable wrapping of long log lines',
                  label: 'No wrap',
                  value: false,
                },
              ]}
            />
          </InlineField>
        </>
      )}
      <LogsPanelHeaderActions vizType={visualizationType} onChange={onChangeVisualizationType} />
    </div>
  );
}

export function getLogsPanelSortOrderFromURL() {
  // Since sort order is used to execute queries before the logs panel is instantiated, the scene url state will never influence the query
  // Hacking this for now to manually check the URL search params to override local storage state if set
  const location = locationService.getLocation();
  const search = new URLSearchParams(location.search);
  const sortOrder = search.get('sortOrder');

  try {
    if (typeof sortOrder === 'string') {
      const decodedSortOrder = narrowLogsSortOrder(JSON.parse(sortOrder));
      if (decodedSortOrder) {
        return decodedSortOrder;
      }
    }
  } catch (e) {
    // URL Params can be manually changed and it will make JSON.parse() fail.
    logger.error(e, { msg: 'LogOptionsScene(getLogsPanelSortOrderFromURL): unable to parse sortOrder' });
  }

  return false;
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonGroupWrapper: css({
    alignItems: 'center',
    margin: 0,
  }),
  container: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
  }),
});

export const OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME = '___OTEL_LOG_ATTRIBUTES___';
export const LOG_LINE_BODY_FIELD_NAME = '___LOG_LINE_BODY___';

export function getNormalizedFieldName(field: string) {
  if (field === LOG_LINE_BODY_FIELD_NAME) {
    return t('logs.logs-drilldown.fields.log-line-field', 'Log line');
  } else if (field === OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME) {
    return t('logs.logs-drilldown.fields.log-attributes-field', 'Log attributes');
  }
  return field;
}
