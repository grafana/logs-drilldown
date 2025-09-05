import React from 'react';

import { css } from '@emotion/css';

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
    <div className={logsControlsSupported ? styles.container : undefined}>
      <RadioButtonGroup
        options={[
          {
            description: 'Show results in logs visualisation',
            label: 'Logs',
            value: 'logs',
          },
          {
            description: 'Show results in table visualisation',
            label: 'Table',
            value: 'table',
          },
          {
            description: 'Show results in json visualisation',
            label: 'JSON',
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
