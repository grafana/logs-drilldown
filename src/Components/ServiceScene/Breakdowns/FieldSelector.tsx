import React, { useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { VariableValueOption } from '@grafana/scenes';
import { Combobox, ComboboxOption, InlineField, useStyles2 } from '@grafana/ui';

import { wrapWildcardSearch } from '../../../services/query';
import { testIds } from '../../../services/testIds';

type Props<T> = {
  label: string;
  onChange: (label: T | undefined) => void;
  options: VariableValueOption[];
  value?: T;
};

export type AsyncFieldSelectorProps = {
  initialFilter: SelectableValue<string>;
  isLoading: boolean;
  selectOption: (value: string) => void;
} & Props<string>;

export function FieldSelector<T extends string | number>({ label, onChange, options, value }: Props<T>) {
  const styles = useStyles2(getStyles);

  const selectableOptions: Array<ComboboxOption<T>> = options.map((option) => {
    return {
      label: option.label,
      value: option.value as T,
    };
  });

  return (
    <InlineField className={styles.selectWrapper} label={label}>
      <Combobox<T>
        options={selectableOptions}
        value={value}
        onChange={(selected) => onChange(selected?.value)}
        prefixIcon="search"
        isClearable
        width="auto"
        minWidth={20}
      />
    </InlineField>
  );
}

export function ServiceFieldSelector({
  initialFilter,
  isLoading,
  label,
  onChange,
  options,
  selectOption,
  value,
}: AsyncFieldSelectorProps) {
  const styles = useStyles2(getStyles);
  const [customOption, setCustomOption] = useState<SelectableValue<string>>(initialFilter);

  const selectableOptions: Array<ComboboxOption<string>> = options.map((option) => {
    return {
      label: option.label,
      value: String(option.value),
    };
  });
  const allOptions =
    customOption && value && customOption.value?.includes(value)
      ? [{ label: customOption.label, value: String(customOption.value) }, ...selectableOptions]
      : selectableOptions;
  const selectableValueSet = new Set(selectableOptions.map((option) => option.value));

  return (
    <InlineField className={styles.serviceSceneSelectWrapper} label={label}>
      <Combobox<string>
        loading={isLoading}
        data-testid={testIds.exploreServiceSearch.search}
        placeholder={t('components.service-scene.breakdowns.field-selector.placeholder-search-values', 'Search values')}
        options={allOptions}
        createCustomValue
        value={value}
        isClearable
        prefixIcon="search"
        onChange={(value) => {
          if (!value?.value) {
            return onChange('');
          }

          if (!selectableValueSet.has(value.value)) {
            setCustomOption({ label: value.label ?? value.value, value: value.value, icon: 'filter' });
            return onChange(wrapWildcardSearch(value.value));
          }

          selectOption(value.value);
        }}
      />
    </InlineField>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    input: css({
      marginBottom: 0,
    }),
    select: css({
      maxWidth: theme.spacing(64),
      minWidth: theme.spacing(20),
    }),
    selectWrapper: css({
      label: 'field-selector-select-wrapper',
      marginBottom: 0,
      maxWidth: theme.spacing(62.5),
      minWidth: theme.spacing(20),
    }),
    serviceSceneSelectWrapper: css({
      label: 'service-select-wrapper',
      marginBottom: 0,
      marginRight: theme.spacing.x1,
      maxWidth: theme.spacing(62.5),
      minWidth: theme.spacing(20),
    }),
  };
}
