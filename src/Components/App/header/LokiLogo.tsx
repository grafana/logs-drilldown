import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PLUGIN_ID } from '../../../services/plugin';

function LokiLogoComponent() {
  const styles = useStyles2(getStyles);

  return <img alt="" className={styles.logo} src={`public/plugins/${PLUGIN_ID}/img/logo.svg`} />;
}

export const LokiLogo = React.memo(LokiLogoComponent);

const getStyles = (theme: GrafanaTheme2) => ({
  logo: css`
    width: 16px;
    height: 16px;
    margin-right: ${theme.spacing(0.75)};
    position: relative;
    top: -2px;
  `,
});
