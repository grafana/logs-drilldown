import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { sceneGraph, SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Combobox, ComboboxOption, InlineField, useStyles2 } from '@grafana/ui';

import { IndexScene } from 'Components/IndexScene/IndexScene';
import { LOKI_CONFIG_API_NOT_SUPPORTED } from 'services/datasourceTypes';
import { runSceneQueries } from 'services/query';
import { getMaxLines, setMaxLines } from 'services/store';
interface LineLimitState extends SceneObjectState {
  error?: string;
  isInvalid?: boolean;
  maxLines?: number;
  maxLinesOptions: Array<ComboboxOption<number>>;
}

/**
 * Max log lines (Loki max_entries_limit) selector.
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
    const limit = getMaxLinesLimit(this);
    this.setState({
      maxLines,
      maxLinesOptions: getMaxLinesOptions(maxLines),
      isInvalid: maxLines > limit,
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
    const newMaxLines = typeof option.value === 'string' ? Number(option.value) : option.value;
    const isValid = this.validateMaxLines(option.value);
    const limit = getMaxLinesLimit(this);
    const isOverLimit = isValid && newMaxLines > limit;

    if (!isValid || isOverLimit) {
      this.setState({
        isInvalid: true,
        maxLines: isValid ? newMaxLines : this.state.maxLines,
        maxLinesOptions: isValid ? getMaxLinesOptions(newMaxLines) : this.state.maxLinesOptions,
      });
      return;
    }

    this.setState({
      isInvalid: false,
      maxLines: newMaxLines,
      maxLinesOptions: getMaxLinesOptions(newMaxLines),
    });
    setMaxLines(this, newMaxLines);
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
          label={t('components.service-scene.line-limit-scene.max-lines-label', 'Line limit')}
          tooltip={t(
            'components.service-scene.line-limit-scene.max-lines-tooltip',
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
            placeholder={t('components.service-scene.line-limit-scene.max-lines-placeholder', '{{logs}} logs', {
              logs: maxLines,
            })}
            createCustomValue
          />
        </InlineField>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    flexShrink: 0,
    gap: theme.spacing(0.5),
    width: 'auto',
  }),
  label: css({
    marginTop: theme.spacing(0.5),
  }),
});

const MAX_LINES_PRESETS = [100, 500, 1000, 2000, 5000] as const;

export const getMaxLinesOptions = (currentMaxLines: number): Array<ComboboxOption<number>> => {
  const defaultOptions: Array<ComboboxOption<number>> = MAX_LINES_PRESETS.map((value) => ({
    value,
    label: value.toString(),
  }));
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
};

export const getMaxLinesLimit = (sceneRef: SceneObject): number => {
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  const lokiConfig = indexScene.state.lokiConfig;
  if (lokiConfig && lokiConfig !== LOKI_CONFIG_API_NOT_SUPPORTED) {
    const limit = lokiConfig.limits.max_entries_limit_per_query;
    if (limit > 0) {
      return limit;
    }
  }
  const dsLimit = indexScene.state.ds?.maxLines;
  if (dsLimit && dsLimit > 0) {
    return dsLimit;
  }
  return MAX_LINES_PRESETS[MAX_LINES_PRESETS.length - 1];
};
