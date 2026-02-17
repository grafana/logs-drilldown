import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, ErrorBoundaryAlert, useStyles2 } from '@grafana/ui';

import { ServiceSelectionContextProvider } from './Context';
import { DataSource } from './DataSource';
import { DefaultLabels } from './DefaultLabels';
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
        <Badge color={'blue'} text={'Experimental'} />
        <span>Configure the default labels to show in the landing page of Logs Drilldown:</span>
      </div>

      <ErrorBoundaryAlert>
        <ServiceSelectionContextProvider initialDSUID={dsUID}>
          <header>
            <DataSource />
          </header>

          <DefaultLabels />

          <Footer />
        </ServiceSelectionContextProvider>
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
