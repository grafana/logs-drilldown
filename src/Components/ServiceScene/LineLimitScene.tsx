import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ComboboxOption, Combobox, IconButton, InlineField, useStyles2 } from '@grafana/ui';

import { runSceneQueries } from 'services/query';
import { getMaxLines, setMaxLines } from 'services/store';

interface LineLimitState extends SceneObjectState {
  maxLines?: number;
  maxLinesOptions: Array<ComboboxOption<number>>;
}

/**
 * The line filter scene used in the logs tab
 */
export class LineLimitScene extends SceneObjectBase<LineLimitState> {
  static Component = LineLimitComponent;

  constructor(state: Partial<LineLimitState> = {}) {
    super({
      ...state,
      maxLinesOptions: [],
    });
    this.addActivationHandler(this.onActivate);
  }

  /**
   * Set initial state on activation
   */
  private onActivate = () => {
    const maxLines = getMaxLines(this);
    this.setState({
      maxLines,
      maxLinesOptions: getMaxLinesOptions(maxLines),
    });
  };

  onChangeMaxLines = (option: ComboboxOption<number>) => {
    if (!option.value) {
      return;
    }
    const newMaxLines = option.value;
    setMaxLines(this, newMaxLines);
    this.setState({
      maxLines: newMaxLines,
    });
    runSceneQueries(this);
  };
}

function LineLimitComponent({ model }: SceneComponentProps<LineLimitScene>) {
  const { maxLines, maxLinesOptions } = model.useState();
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      <IconButton
        name="info-circle"
        tooltip={t(
          'logs.log-options.max-lines-tooltip',
          'Number of log lines to request. Depends on the Loki configuration value for max_entries_limit.'
        )}
        tooltipPlacement="left-start"
      />
      {maxLines && (
        <InlineField
          aria-label={t('logs.log-options.max-lines-label', 'Number of log lines to request')}
          className={styles.label}
        >
          <Combobox<number>
            options={maxLinesOptions}
            value={maxLines}
            width="auto"
            minWidth={8}
            onChange={model.onChangeMaxLines}
            placeholder={t('logs.log-options.max-lines-label', '{{logs}} logs', { logs: maxLines })}
            createCustomValue
          />
        </InlineField>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    gap: theme.spacing(0.5),
  }),
  label: css({
    marginRight: 0,
  }),
});

function getMaxLinesOptions(currentMaxLines: number): Array<ComboboxOption<number>> {
  const defaultOptions = [
    { value: 100, label: '100' },
    { value: 500, label: '500' },
    { value: 1000, label: '1000' },
    { value: 2000, label: '2000' },
    { value: 5000, label: '5000' },
  ];
  if (defaultOptions.find((option) => option.value === currentMaxLines)) {
    return defaultOptions;
  }
  let index = defaultOptions.findIndex((option) => option.value > currentMaxLines);
  index = index <= 0 ? 0 : index;
  defaultOptions.splice(index, 0, {
    value: currentMaxLines,
    label: currentMaxLines.toString(),
  });
  return defaultOptions;
}
