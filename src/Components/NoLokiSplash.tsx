import React from 'react';

import { locationUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { EmptyState, TextLink } from '@grafana/ui';

import { useSharedStyles } from 'styles/shared-styles';

export const NoLokiSplash = () => {
  const sharedStyles = useSharedStyles();

  return (
    <div className={sharedStyles.emptyStateWrap}>
      <EmptyState
        variant="not-found"
        message={t('components.no-loki-splash.welcome-to-grafana-logs-drilldown', 'Welcome to Grafana Logs Drilldown')}
      >
        <p>
          <Trans i18nKey="components.no-loki-splash.no-datasource">
            We noticed there is no Loki datasource configured.
            <br />
            Add a{' '}
            <a className="external-link" href={locationUtil.assureBaseUrl('/connections/datasources/new')}>
              Loki datasource
            </a>{' '}
            to view logs.
          </Trans>
        </p>
        <p>
          <Trans i18nKey="components.no-loki-splash.learn-more">
            Click{' '}
            <TextLink href="https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/" external>
              here
            </TextLink>{' '}
            to learn more...
          </Trans>
        </p>
      </EmptyState>
    </div>
  );
};
