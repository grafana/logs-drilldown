import React from 'react';

import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ButtonCascader, CascaderOption, InlineField } from '@grafana/ui';

import { runSceneQueries } from 'services/query';
import { getMaxLines, setMaxLines } from 'services/store';

interface LineLimitState extends SceneObjectState {
  maxLines?: number;
  maxLinesOptions: CascaderOption[];
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

  onChangeMaxLines = (value: string[]) => {
    if (!value.length) {
      return;
    }
    const newMaxLines = parseInt(value[0], 10);
    setMaxLines(this, newMaxLines);
    this.setState({
      maxLines: newMaxLines,
    });
    runSceneQueries(this);
  };
}

function LineLimitComponent({ model }: SceneComponentProps<LineLimitScene>) {
  const { maxLines, maxLinesOptions } = model.useState();

  return (
    <div>
      {maxLines && (
        <InlineField
          aria-label={t('logs.log-options.max-lines-label', 'Number of log lines to request')}
          className={styles.label}
        >
          <ButtonCascader
            options={maxLinesOptions}
            buttonProps={{ variant: 'secondary' }}
            value={[maxLines.toString()]}
            onChange={model.onChangeMaxLines}
          >
            {t('logs.log-options.max-lines-label', '{{logs}} logs', { logs: maxLines })}
          </ButtonCascader>
        </InlineField>
      )}
    </div>
  );
}

const styles = {
  label: css({
    marginRight: 0,
  }),
};

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
