import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { addLastUsedDataSourceToStorage } from 'services/store';

interface Props {}

export const DataSource = (props: Props) => {
  const styles = useStyles2(getStyles);
  const { dsUID, setDsUID } = useDefaultColumnsContext();
  return (
    <div className={styles.datasource}>
      <DataSourcePicker
        width={60}
        filter={(ds) => ds.type === 'loki'}
        current={dsUID !== '' ? dsUID : null}
        onChange={(ds) => {
          addLastUsedDataSourceToStorage(ds.uid);
          setDsUID(ds.uid);
        }}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  datasource: css({
    marginBottom: theme.spacing(2),
  }),
});
