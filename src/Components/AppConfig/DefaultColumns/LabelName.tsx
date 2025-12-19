import React from 'react';

import { css } from '@emotion/css';
import { memoize } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { Combobox, useStyles2 } from '@grafana/ui';
import { ComboboxOption } from '@grafana/ui/dist/types/components/Combobox/types';

import { useDefaultColumnsContext } from './Context';
import { mapColumnsLabelsToAdHocFilters } from './LabelsQueries';
import { getDatasource } from './State';
import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabels } from './types';
import { logger } from 'services/logger';
import { getLabelsKeys } from 'services/TagKeysProviders';
import { SERVICE_NAME } from 'services/variables';

interface ValueProps {
  labelIndex: number;
  recordIndex: number;
}

export const LabelName = ({ recordIndex, labelIndex }: ValueProps) => {
  const { dsUID, records, setRecords } = useDefaultColumnsContext();
  const columnsLabels = records?.[recordIndex].labels;
  const labelName = columnsLabels?.[labelIndex].key;
  const styles = useStyles2(getStyles);

  const onSelectFieldName = (labelName: string) => {
    if (records) {
      const recordToUpdate = records[recordIndex];
      const labelToUpdate = recordToUpdate?.labels[labelIndex];
      labelToUpdate.key = labelName;
      labelToUpdate.value = undefined;

      setRecords(records);
    }
  };

  return (
    <div className={styles.valuesFieldsContainer}>
      <Combobox<string>
        value={labelName}
        invalid={!labelName}
        placeholder={'Select label name'}
        width={'auto'}
        minWidth={30}
        maxWidth={90}
        createCustomValue={true}
        onChange={(fieldName) => onSelectFieldName(fieldName?.value)}
        options={(typeAhead) =>
          getLabels(columnsLabels ?? [], dsUID).then((opts) => opts.filter((opt) => opt.value.includes(typeAhead)))
        }
      />
    </div>
  );
};

const getLabels = memoize(
  async (
    columnsLabels: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsLabels,
    dsUID: string
  ): Promise<ComboboxOption[]> => {
    const datasource = await getDatasource(dsUID);
    if (!datasource || !datasource.getResource) {
      const error = new Error(`Data source ${dsUID} not found`);
      logger.error(error, { msg: 'DefaultColumnsLabelName::getLabels - Data source not found!' });
      throw error;
    }

    const labelFilters = mapColumnsLabelsToAdHocFilters(columnsLabels ?? []);
    const getLabelsKeysPromise = getLabelsKeys(labelFilters, datasource);
    const results = await getLabelsKeysPromise;
    const options = results.map((label) => ({ value: label.text }));
    const serviceNameIdx = options.findIndex((label) => label.value === SERVICE_NAME);
    if (serviceNameIdx !== -1) {
      const service = options.splice(serviceNameIdx, 1);
      options.unshift(service[0]);
    }
    return options;
  }
);

const getStyles = (theme: GrafanaTheme2) => ({
  valuesContainer: css({
    label: 'valuesContainer',
    marginLeft: theme.spacing(2),
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(1),
  }),
  valueContainer: css({
    label: 'valueContainer',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  valueContainer__add: css({
    marginTop: theme.spacing(2),
  }),

  valuesFieldsContainer: css({}),
  fieldsContainer: css({ marginLeft: theme.spacing(2) }),
});
