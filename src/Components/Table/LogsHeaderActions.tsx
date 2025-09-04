import React, { useCallback, useMemo, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { ButtonCascader, CascaderOption, InlineField, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { logsControlsSupported } from 'services/panel';
import { runSceneQueries } from 'services/query';
import { getMaxLines, LogsVisualizationType, setMaxLines } from 'services/store';

/**
 * The options shared between logs and table panels
 * @param props
 * @constructor
 */
export function LogsPanelHeaderActions(props: {
  onChange: (type: LogsVisualizationType) => void;
  sceneRef: SceneObject;
  vizType: LogsVisualizationType;
}) {
  const [maxLines, setMaxLinesState] = useState(getMaxLines(props.sceneRef));
  const maxLinesOptions: CascaderOption[] = useMemo(
    () => getMaxLinesOptions(getMaxLines(props.sceneRef)),
    [props.sceneRef]
  );
  const styles = useStyles2(getStyles);

  const onChangeMaxLines = useCallback(
    (value: string[]) => {
      if (!value.length) {
        return;
      }
      const newMaxLines = parseInt(value[0], 10);
      setMaxLines(props.sceneRef, newMaxLines);
      setMaxLinesState(newMaxLines);
      runSceneQueries(props.sceneRef);
    },
    [props.sceneRef]
  );

  return (
    <div className={logsControlsSupported ? styles.container : undefined}>
      {maxLines && (
        <InlineField
          className={styles.inlineField}
          aria-label={t('logs.log-options.max-lines-label', 'Number of log lines to request')}
        >
          <ButtonCascader
            options={maxLinesOptions}
            buttonProps={{ size: 'sm', variant: 'secondary' }}
            value={[maxLines.toString()]}
            onChange={onChangeMaxLines}
          >
            {t('logs.log-options.max-lines-label', '{{logs}} logs', { logs: maxLines })}
          </ButtonCascader>
        </InlineField>
      )}
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

const getStyles = (theme: GrafanaTheme2) => ({
  withControls: css({
    paddingRight: 6,
  }),
  container: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
  }),
  inlineField: css({
    margin: 0,
  }),
});

function getMaxLinesOptions(currentMaxLines: number) {
  const stringMaxLines = currentMaxLines.toString();
  const defaultOptions = [
    { value: '100', label: '100' },
    { value: '500', label: '500' },
    { value: '1000', label: '1000' },
    { value: '2000', label: '2000' },
    { value: '5000', label: '5000' },
  ];
  if (defaultOptions.find((option) => option.value === stringMaxLines)) {
    return defaultOptions;
  }
  let index = defaultOptions.findIndex((option) => parseInt(option.value, 10) > currentMaxLines);
  index = index <= 0 ? 0 : index;
  defaultOptions.splice(index, 0, {
    value: stringMaxLines,
    label: stringMaxLines,
  });
  return defaultOptions;
}
