import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, ErrorBoundaryAlert, useStyles2 } from '@grafana/ui';

import { ServiceSelectionContextProvider } from './Context';
import { DataSource } from './DataSource';
import { DefaultLabels } from './DefaultLabels';
import { Footer } from './Footer';
import { isDefaultLabelsSupported } from './isSupported';
import { Unsupported } from './Unsupported';
import { NoLokiSplash } from 'Components/NoLokiSplash';
import { getDefaultDatasourceFromDatasourceSrv, getLastUsedDataSourceFromStorage } from 'services/store';

const Config = () => {
  const dsUID = getLastUsedDataSourceFromStorage() ?? getDefaultDatasourceFromDatasourceSrv();
  const styles = useStyles2(getStyles);
  if (!dsUID) {
    return <NoLokiSplash />;
  }
  if (!isDefaultLabelsSupported()) {
    return <Unsupported />;
  }

  return (
    <main className={styles.main}>
      <div className={styles.introText}>
        <Badge color={'blue'} text={t('components.config.text-beta', 'Beta')} />
        <span>
          <Trans i18nKey="components.config.service-selection-description">
            Configure which labels and label values appear by default on the Logs Drilldown landing page.
          </Trans>
        </span>
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
