import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Badge, useStyles2 } from '@grafana/ui';

import { DefaultColumns } from './DefaultColumns';
import { DefaultColumnsContextProvider } from './DefaultColumnsContext';
import { DefaultColumnsDataSource } from './DefaultColumnsDataSource';
import { DefaultColumnsFooter } from './DefaultColumnsFooter';
import { DefaultColumnsUnsupported } from './DefaultColumnsUnsupported';
import { NoLokiSplash } from 'Components/NoLokiSplash';
import { getDefaultDatasourceFromDatasourceSrv, getLastUsedDataSourceFromStorage } from 'services/store';

const DefaultColumnsConfig = () => {
  const dsUID = getLastUsedDataSourceFromStorage() ?? getDefaultDatasourceFromDatasourceSrv();
  const styles = useStyles2(getStyles);
  if (!dsUID) {
    return <NoLokiSplash />;
  }
  if (
    !config.featureToggles.kubernetesLogsDrilldown ||
    !config.featureToggles.grafanaAPIServerWithExperimentalAPIs ||
    config.buildInfo.version < '12.4'
  ) {
    return <DefaultColumnsUnsupported />;
  }

  return (
    <main className={styles.main}>
      <div className={styles.introText}>
        <Badge color={'blue'} text={'Experimental'} />
        <span>Configure default fields to display instead of the full log line:</span>
      </div>

      <DefaultColumnsContextProvider initialDSUID={dsUID}>
        <header>
          <DefaultColumnsDataSource />
        </header>
        <>
          <section>
            <DefaultColumns />
          </section>
        </>

        <DefaultColumnsFooter />
      </DefaultColumnsContextProvider>
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
    overflow: 'hidden',
    width: '100%',
  }),
});

export default DefaultColumnsConfig;
