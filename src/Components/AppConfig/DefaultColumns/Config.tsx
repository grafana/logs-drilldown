import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, ErrorBoundaryAlert, useStyles2 } from '@grafana/ui';

import { DefaultColumnsContextProvider } from './Context';
import { DataSource } from './DataSource';
import { DefaultColumns } from './DefaultColumns';
import { Footer } from './Footer';
import { isDefaultColumnsSupported } from './isSupported';
import { Unsupported } from './Unsupported';
import { NoLokiSplash } from 'Components/NoLokiSplash';
import { getDefaultDatasourceFromDatasourceSrv, getLastUsedDataSourceFromStorage } from 'services/store';

const Config = () => {
  const dsUID = getLastUsedDataSourceFromStorage() ?? getDefaultDatasourceFromDatasourceSrv();
  const styles = useStyles2(getStyles);
  if (!dsUID) {
    return <NoLokiSplash />;
  }
  if (!isDefaultColumnsSupported) {
    return <Unsupported />;
  }

  return (
    <main className={styles.main}>
      <div className={styles.introText}>
        <Badge color={'blue'} text={'Beta'} />
        <span>Configure default fields to display instead of the full log line:</span>
      </div>

      <ErrorBoundaryAlert>
        <DefaultColumnsContextProvider initialDSUID={dsUID}>
          <header>
            <DataSource />
          </header>
          <>
            <section>
              <DefaultColumns />
            </section>
          </>

          <Footer />
        </DefaultColumnsContextProvider>
      </ErrorBoundaryAlert>
    </main>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  introText: css({
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    gap: theme.spacing(1),
  }),
  main: css({
    width: '100%',
  }),
});

export default Config;
