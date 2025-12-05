import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getDefaultDatasourceFromDatasourceSrv } from '../../services/store';
import { NoLokiSplash } from '../NoLokiSplash';
import { DefaultColumns } from './DefaultColumns';
import { DefaultColumnsContextProvider } from './DefaultColumnsContext';
import { DefaultColumnsDataSource } from './DefaultColumnsDataSource';
import { DefaultColumnsFooter } from './DefaultColumnsFooter';

const DefaultColumnsConfig = () => {
  const dsUID = getDefaultDatasourceFromDatasourceSrv();
  const styles = useStyles2(getStyles);
  if (!dsUID) {
    return <NoLokiSplash />;
  }

  return (
    <main className={styles.main}>
      <p>Configure default fields to display instead of the full log line:</p>

      <DefaultColumnsContextProvider initialDSUID={dsUID}>
        <header>
          <DefaultColumnsDataSource />
        </header>
        <section>
          <DefaultColumns />
        </section>
        <DefaultColumnsFooter />
      </DefaultColumnsContextProvider>
    </main>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  main: css({
    overflow: 'hidden',
    width: '100%',
  }),
});

export default DefaultColumnsConfig;
