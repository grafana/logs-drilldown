import React from 'react';

import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { RadioButtonGroup } from '@grafana/ui';

import { logsControlsSupported } from 'services/panel';
import { LogsVisualizationType } from 'services/store';

/**
 * The options shared between logs and table panels
 * @param props
 * @constructor
 */
export function LogsPanelHeaderActions(props: {
  onChange: (type: LogsVisualizationType) => void;
  vizType: LogsVisualizationType;
}) {
  return (
    <div className={logsControlsSupported() ? styles.container : undefined}>
      <RadioButtonGroup
        options={[
          {
            description: t(
              'components.logs-panel-header-actions.description.show-results-in-logs-visualisation',
              'Show results in logs visualisation'
            ),
            label: t('components.logs-panel-header-actions.label.logs', 'Logs'),
            value: 'logs',
          },
          {
            description: t(
              'components.logs-panel-header-actions.description.show-results-in-table-visualisation',
              'Show results in table visualisation'
            ),
            label: t('components.logs-panel-header-actions.label.table', 'Table'),
            value: 'table',
          },
          {
            description: t(
              'components.logs-panel-header-actions.description.show-results-in-json-visualisation',
              'Show results in json visualisation'
            ),
            label: t('components.logs-panel-header-actions.label.json', 'JSON'),
            value: 'json',
          },
        ]}
        size="sm"
        value={props.vizType}
        onChange={props.onChange}
      />
    </div>
  );
}

const styles = {
  container: css({
    paddingRight: 6,
  }),
};
