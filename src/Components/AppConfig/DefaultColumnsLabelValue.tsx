import React from 'react';

import { css } from '@emotion/css';
import { isArray, memoize } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { AdHocFilterWithLabels } from '@grafana/scenes';
import { Combobox, ComboboxOption, useStyles2 } from '@grafana/ui';

import { LabelFilterOp } from '../../services/filterTypes';
import { getLabelValues } from '../../services/TagValuesProviders';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { mapColumnsLabelsToAdHocFilters } from './DefaultColumnsLabelsQueries';
import { getDatasource } from './DefaultColumnsState';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel } from './types';

interface Props {
  labelIndex: number;
  recordIndex: number;
}
export function DefaultColumnsLabelValue({ recordIndex, labelIndex }: Props) {
  const { dsUID, records, setRecords } = useDefaultColumnsContext();
  const labels = records?.[recordIndex].labels;
  const label = labels?.[labelIndex];
  const styles = useStyles2(getStyles);

  const onSelectLabelValue = (option: ComboboxOption) => {
    if (records) {
      const recordToUpdate = records[recordIndex];
      const labelToUpdate = recordToUpdate.labels[labelIndex];
      labelToUpdate.value = option.value;

      setRecords(records);
    }
  };

  const getColumnsLabelValues = memoize(
    async (label: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel): Promise<ComboboxOption[]> => {
      const datasource = await getDatasource(dsUID);
      if (datasource) {
        const labelFilters = labels?.filter((f) => f.key !== label.key) ?? [];
        const filters = mapColumnsLabelsToAdHocFilters(labelFilters);
        const filter: AdHocFilterWithLabels = { value: `""`, key: label.key, operator: LabelFilterOp.NotEqual };
        const result = await getLabelValues(filters, filter, datasource, dsUID);

        if (isArray(result)) {
          return result
            .map((metricFindValue) => {
              const value = metricFindValue.text.toString();
              return {
                value,
                label: value,
              };
            })
            .filter((v) => {
              const isThisValueAlreadySelected = v.value === label.value;
              const doOtherFiltersHaveThisValue = !labels?.some((l) => l.key === filter.key && l.value === v.value);
              return isThisValueAlreadySelected || doOtherFiltersHaveThisValue;
            });
        }
      }

      return [];
    }
  );

  if (!label) {
    return null;
  }

  return (
    <span className={styles.defaultColumnsLabelValue}>
      <Combobox<string>
        invalid={!label?.value}
        placeholder={'Select label value'}
        width={'auto'}
        minWidth={30}
        value={label?.value}
        maxWidth={90}
        disabled={!label.key}
        createCustomValue={true}
        onChange={(opt) => onSelectLabelValue(opt)}
        options={(typeAhead) =>
          getColumnsLabelValues(label).then((opts) => opts.filter((opt) => opt.value.includes(typeAhead)))
        }
      />
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  defaultColumnsLabelValue: css({
    label: 'defaultColumnsLabelValue',
    marginLeft: theme.spacing(1),
  }),
});
