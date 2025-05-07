import React from 'react';

import { css } from '@emotion/css';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2, locationUtil } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

export const NoLokiSplash = () => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  return (
    <div className={styles.wrap}>
      <div className={styles.graphicContainer}>
        <SVG
          src={
            theme.isDark
              ? `/public/plugins/grafana-lokiexplore-app/img/grot_loki.svg`
              : `/public/plugins/grafana-lokiexplore-app/img/grot_loki.svg`
          }
        />
      </div>
      <div className={styles.text}>
        <h3 className={styles.title}>Welcome to Grafana Logs Drilldown</h3>

        <p>
          We noticed there is no Loki datasource configured.
          <br />
          Add a{' '}
          <a className={'external-link'} href={locationUtil.assureBaseUrl(`/connections/datasources/new`)}>
            Loki datasource
          </a>{' '}
          to view logs.
        </p>

        <br />

        <p>
          Click{' '}
          <a
            href={'https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/'}
            target={'_blank'}
            className={'external-link'}
            rel="noreferrer"
          >
            here
          </a>{' '}
          to learn more...
        </p>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    graphicContainer: css({
      [theme.breakpoints.up('md')]: {
        alignSelf: 'flex-end',
        height: 'auto',
        padding: theme.spacing(1),
        width: '300px',
      },
      [theme.breakpoints.up('lg')]: {
        alignSelf: 'flex-end',
        height: 'auto',
        padding: theme.spacing(1),
        width: '400px',
      },
      display: 'flex',
      height: '250px',
      justifyContent: 'center',
      margin: '0 auto',
      padding: theme.spacing(1),
      width: '200px',
    }),

    text: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }),
    title: css({
      marginBottom: '1.5rem',
    }),
    wrap: css({
      [theme.breakpoints.up('md')]: {
        flexDirection: 'row',
        margin: '4rem auto auto auto',
      },
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      margin: '0 auto auto auto',
      padding: '2rem',
      textAlign: 'center',
    }),
  };
};
