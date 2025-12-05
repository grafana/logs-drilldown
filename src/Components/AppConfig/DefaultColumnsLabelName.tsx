import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Combobox, useStyles2 } from '@grafana/ui';
import { ComboboxOption } from '@grafana/ui/dist/types/components/Combobox/types';

import { getLabelsKeys } from '../../services/TagKeysProviders';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { mapColumnsLabelsToAdHocFilters } from './DefaultColumnsLabelsQueries';
import { getDatasource } from './DefaultColumnsState';

interface ValueProps {
  labelIndex: number;
  recordIndex: number;
}

export const DefaultColumnsLabelName = ({ recordIndex, labelIndex }: ValueProps) => {
  const { dsUID, setLocalDefaultColumnsDatasourceState, localDefaultColumnsState } = useDefaultColumnsContext();
  const columnsLabels = localDefaultColumnsState?.[dsUID]?.records[recordIndex].labels;
  const labelName = columnsLabels?.[labelIndex].key;
  const styles = useStyles2(getStyles);

  const getLabels = async (): Promise<ComboboxOption[]> => {
    const datasource = await getDatasource(dsUID);
    if (!datasource || !datasource.getResource) {
      throw new Error('Datasource not found');
    }

    const labelFilters = mapColumnsLabelsToAdHocFilters(columnsLabels ?? []);
    const getLabelsKeysPromise = getLabelsKeys(labelFilters, datasource);
    const results = await getLabelsKeysPromise;
    return results.map((label) => ({ value: label.text }));
  };

  const onSelectFieldName = (labelName: string) => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      const labelToUpdate = recordToUpdate.labels[labelIndex];
      labelToUpdate.key = labelName;
      labelToUpdate.value = undefined;

      setLocalDefaultColumnsDatasourceState({ ...ds, records });
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
        options={(typeAhead) => getLabels().then((opts) => opts.filter((opt) => opt.value.includes(typeAhead)))}
      />
    </div>
  );
};

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
