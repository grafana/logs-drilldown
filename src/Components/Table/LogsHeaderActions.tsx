import React from 'react';
import { RadioButtonGroup } from '@grafana/ui';
import { LogsVisualizationType } from 'services/store';
import { css } from '@emotion/css';
import { logsControlsSupported } from 'services/panel';

/**
 * The options shared between logs and table panels
 * @param props
 * @constructor
 */
export function LogsPanelHeaderActions(props: {
  vizType: LogsVisualizationType;
  onChange: (type: LogsVisualizationType) => void;
}) {
  return (
    <div className={logsControlsSupported ? styles.container : undefined}>
      <RadioButtonGroup
        options={[
          {
            label: 'Logs',
            value: 'logs',
            description: 'Show results in logs visualisation',
          },
          {
            label: 'Table',
            value: 'table',
            description: 'Show results in table visualisation',
          },
          {
            label: 'JSON',
            value: 'json',
            description: 'Show results in json visualisation',
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
