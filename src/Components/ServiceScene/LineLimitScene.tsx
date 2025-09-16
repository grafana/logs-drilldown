import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ComboboxOption, Combobox, InlineField, useStyles2 } from '@grafana/ui';

import { runSceneQueries } from 'services/query';
import { getMaxLines, setMaxLines } from 'services/store';

interface LineLimitState extends SceneObjectState {
  error?: string;
  isInvalid?: boolean;
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
      isInvalid: false,
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
      isInvalid: false,
    });
  };

  /**
   * Validate if the max lines value is number, custom input is a string
   */
  private validateMaxLines = (value: number | string): boolean => {
    if (!value) {
      return false;
    }

    // Convert string to number
    const numValue = typeof value === 'string' ? Number(value) : value;

    // Check if it's a valid positive integer
    if (isNaN(numValue) || numValue <= 0 || !Number.isInteger(numValue)) {
      return false;
    }
    return true;
  };

  onChangeMaxLines = (option: ComboboxOption<number>) => {
    const isValid = this.validateMaxLines(option.value);
    if (!isValid) {
      this.setState({
        isInvalid: true,
      });
    } else {
      this.setState({
        isInvalid: false,
      });
    }
    const newMaxLines = option.value;
    setMaxLines(this, newMaxLines);
    this.setState({
      maxLines: newMaxLines,
    });
    runSceneQueries(this);
    reportInteraction('grafana_logs_app_line_limit_changed', {
      maxLines: newMaxLines,
    });
  };
}

function LineLimitComponent({ model }: SceneComponentProps<LineLimitScene>) {
  const { error, maxLines, maxLinesOptions, isInvalid } = model.useState();

  const styles = useStyles2(getStyles);
  const isMaxEntriesError = error?.toLowerCase().includes('max entries limit');

  return (
    <div className={styles.container}>
      {maxLines && maxLinesOptions.length > 0 && (
        <InlineField
          className={styles.label}
          label={t('logs.log-options.max-lines-label', 'Line limit')}
          tooltip={t(
            'logs.log-options.max-lines-tooltip',
            'Number of log lines to request. Depends on the Loki configuration value for max_entries_limit.'
          )}
          invalid={isInvalid || isMaxEntriesError}
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
    flexDirection: 'column',
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
