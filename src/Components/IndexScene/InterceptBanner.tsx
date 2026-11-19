import React, { useEffect, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { usePluginUserStorage } from '@grafana/runtime';
import { Alert, useStyles2 } from '@grafana/ui';

import { logger } from 'services/logger';
import { testIds } from 'services/testIds';

const storageKey = 'welcomeBannerDismissed';

export function InterceptBanner() {
  const styles = useStyles2(getStyles);
  const userStorage = usePluginUserStorage();
  const [isInterceptBannerVisible, setInterceptBannerVisible] = useState(false);

  useEffect(() => {
    userStorage.getItem(storageKey).then(
      (value) => {
        setInterceptBannerVisible(value !== 'true');
      },
      (error) => {
        logger.error(error, { msg: 'Failed to read welcome banner preference' });
        setInterceptBannerVisible(true);
      }
    );
  }, [userStorage]);

  const dismiss = async () => {
    try {
      await userStorage.setItem(storageKey, 'true');
      setInterceptBannerVisible(false);
    } catch (error) {
      logger.error(error, { msg: 'Failed to save welcome banner preference' });
    }
  };

  if (!isInterceptBannerVisible) {
    return null;
  }

  return (
    <div className={styles.bannerContainer}>
      <Alert
        data-testid={testIds.index.welcomeBanner}
        className={styles.alert}
        severity={'info'}
        title={t(
          'components.index-scene.intercept-banner.title-welcome-to-grafana-logs-drilldown',
          'Welcome to Grafana Logs Drilldown!'
        )}
        onRemove={dismiss}
      >
        <div>
          <Trans i18nKey="components.index-scene.intercept-banner.body">
            Check out our{' '}
            <a
              className="external-link"
              target="_blank"
              href="https://grafana.com/docs/grafana-cloud/visualizations/simplified-exploration/logs/"
              rel="noreferrer"
            >
              Get started doc
            </a>
            , or see{' '}
            <a
              className="external-link"
              target="_blank"
              href="https://github.com/grafana/logs-drilldown/releases"
              rel="noreferrer"
            >
              recent changes
            </a>
            .<br />
            Help us shape the future of the app.{' '}
            <a className="external-link" target="_blank" href="https://forms.gle/1sYWCTPvD72T1dPH9" rel="noreferrer">
              Send us feedback
            </a>{' '}
            or engage with us on{' '}
            <a
              className="external-link"
              target="_blank"
              href="https://github.com/grafana/logs-drilldown/?tab=readme-ov-file#grafana-logs-drilldown"
              rel="noreferrer"
            >
              GitHub
            </a>
            .
          </Trans>
        </div>
      </Alert>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    alert: css({
      flex: 'none',
    }),
    bannerContainer: css({
      padding: theme.spacing(2, 2, 0, 2),
    }),
  };
}
