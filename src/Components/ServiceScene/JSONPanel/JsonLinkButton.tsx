import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';

import { KeyPath } from '@gtk-grafana/react-json-tree/dist/types';

function JsonLinkButton(props: { href: string; keyPath: KeyPath }) {
  const styles = useStyles2(getStyles);
  return (
    <LinkButton
      icon={'external-link-alt'}
      className={styles.button}
      variant={'secondary'}
      size={'sm'}
      fill={'outline'}
      href={props.href}
      target={'_blank'}
    >
      {props.keyPath[0]}
    </LinkButton>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      height: '20px',
      marginTop: '-2px',
    }),
  };
};

export default JsonLinkButton;
